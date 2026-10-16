"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import type { TaskPriority, TaskStatus } from "@/db/schema";
import { actor, deny } from "@/lib/auth";
import { canEditTask, canWorkOnTask, manages } from "@/lib/perm";
import { log, notify } from "@/lib/log";
import { safe } from "@/lib/safe";
import { statusLabel } from "@/lib/meta";

const STATUS = z.enum(["backlog", "todo", "in_progress", "review", "blocked", "done", "cancelled"]);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const TaskInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().max(20000).optional(),
  subteamId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  status: STATUS.optional(),
  priority: z.number().int().min(0).max(4).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  startDate: DATE.optional(),
  dueDate: DATE.optional(),
  estimateHours: z.number().min(0).max(10000).nullable().optional(),
  labels: z.array(z.string().max(40)).optional(),
});

async function loadTask(id: string) {
  const db = await getDb();
  const [t] = await db.select().from(s.tasks).where(eq(s.tasks.id, id));
  if (!t) throw new Error("Task not found");
  const assignees = (await db.select().from(s.taskAssignees).where(eq(s.taskAssignees.taskId, id))).map((a) => a.userId);
  return { db, t, assignees };
}

const href = (n: number) => `/tasks?task=${n}`;

function done() {
  revalidatePath("/", "layout");
}

export async function createTask(input: z.input<typeof TaskInput>) {
  return safe(async () => {
    const me = await actor();
    const v = TaskInput.parse(input);
    const db = await getDb();
    let allowed = manages(me, v.subteamId);
    if (!allowed && v.parentId) {
      const { t, assignees } = await loadTask(v.parentId);
      allowed = canWorkOnTask(me, t, assignees);
    }
    if (!allowed) deny("Only heads and co-heads can create tasks for this subteam.");
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${s.tasks.sortOrder}), 0)` }).from(s.tasks);
    const [t] = await db
      .insert(s.tasks)
      .values({
        title: v.title,
        description: v.description ?? "",
        subteamId: v.subteamId,
        projectId: v.projectId ?? null,
        parentId: v.parentId ?? null,
        status: v.status ?? "todo",
        priority: (v.priority ?? 0) as TaskPriority,
        startDate: v.startDate ?? null,
        dueDate: v.dueDate ?? null,
        estimateHours: v.estimateHours ?? null,
        labels: v.labels ?? [],
        sortOrder: Number(max) + 1,
        createdBy: me.id,
        completedAt: v.status === "done" ? new Date() : null,
      })
      .returning();
    if (v.assigneeIds?.length) {
      await db.insert(s.taskAssignees).values(v.assigneeIds.map((userId) => ({ taskId: t.id, userId })));
      await notify(db, me.id, v.assigneeIds, { title: `${me.name} assigned you a task`, body: t.title, href: href(t.number) });
    }
    await log(db, me.id, "task", t.id, "created", { title: t.title });
    done();
    return { id: t.id, number: t.number };
  });
}

const Patch = TaskInput.partial().omit({ assigneeIds: true });

export async function updateTask(id: string, patch: z.input<typeof Patch>) {
  return safe(async () => {
    const me = await actor();
    const v = Patch.parse(patch);
    const { db, t, assignees } = await loadTask(id);
    const full = canEditTask(me, t);
    const keys = Object.keys(v);
    if (!full) {
      const workerFields = ["status"];
      if (!canWorkOnTask(me, t, assignees) || keys.some((k) => !workerFields.includes(k)))
        deny("You can only change the status of tasks assigned to you.");
    }
    if (v.subteamId && v.subteamId !== t.subteamId && !manages(me, v.subteamId)) deny("You can't move tasks into that subteam.");
    if (v.parentId === id) deny("A task can't be its own parent.");

    const set: Partial<typeof s.tasks.$inferInsert> = { updatedAt: new Date() };
    for (const k of keys) (set as Record<string, unknown>)[k] = (v as Record<string, unknown>)[k];
    if (v.status && v.status !== t.status) set.completedAt = v.status === "done" ? new Date() : null;
    await db.update(s.tasks).set(set).where(eq(s.tasks.id, id));

    if (v.status && v.status !== t.status) {
      await log(db, me.id, "task", id, "status", { from: t.status, to: v.status });
      await notify(db, me.id, [...assignees, t.createdBy], {
        title: `${me.name} moved ${t.title} to ${statusLabel(v.status as TaskStatus)}`,
        href: href(t.number),
      });
    }
    for (const k of ["dueDate", "priority", "title", "subteamId", "projectId", "startDate", "estimateHours"] as const)
      if (k in v && (v as Record<string, unknown>)[k] !== (t as Record<string, unknown>)[k])
        await log(db, me.id, "task", id, k, { from: (t as Record<string, unknown>)[k] ?? null, to: (v as Record<string, unknown>)[k] ?? null });
    if ("description" in v && v.description !== t.description) await log(db, me.id, "task", id, "description");
    done();
  });
}

export async function setAssignees(id: string, userIds: string[]) {
  return safe(async () => {
    const me = await actor();
    const ids = z.array(z.string().uuid()).parse(userIds);
    const { db, t, assignees } = await loadTask(id);
    if (!canEditTask(me, t)) deny();
    await db.delete(s.taskAssignees).where(eq(s.taskAssignees.taskId, id));
    if (ids.length) await db.insert(s.taskAssignees).values(ids.map((userId) => ({ taskId: id, userId })));
    const added = ids.filter((x) => !assignees.includes(x));
    const removed = assignees.filter((x) => !ids.includes(x));
    if (added.length || removed.length) await log(db, me.id, "task", id, "assignees", { added, removed });
    await notify(db, me.id, added, { title: `${me.name} assigned you a task`, body: t.title, href: href(t.number) });
    await db.update(s.tasks).set({ updatedAt: new Date() }).where(eq(s.tasks.id, id));
    done();
  });
}

export async function bulkUpdate(ids: string[], patch: { status?: TaskStatus; priority?: TaskPriority; assigneeId?: string; dueDate?: string | null; projectId?: string | null; delete?: boolean }) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const rows = await db.select().from(s.tasks).where(inArray(s.tasks.id, ids));
    const allowed = rows.filter((t) => canEditTask(me, t));
    if (!allowed.length) deny();
    const allowedIds = allowed.map((t) => t.id);
    if (patch.delete) {
      await db.delete(s.tasks).where(inArray(s.tasks.id, allowedIds));
      for (const t of allowed) await log(db, me.id, "task", t.id, "deleted", { title: t.title, number: t.number });
    } else {
      const set: Partial<typeof s.tasks.$inferInsert> = { updatedAt: new Date() };
      if (patch.status) {
        set.status = patch.status;
        set.completedAt = patch.status === "done" ? new Date() : null;
      }
      if (patch.priority !== undefined) set.priority = patch.priority;
      if (patch.dueDate !== undefined) set.dueDate = patch.dueDate;
      if (patch.projectId !== undefined) set.projectId = patch.projectId;
      await db.update(s.tasks).set(set).where(inArray(s.tasks.id, allowedIds));
      if (patch.assigneeId) {
        await db
          .insert(s.taskAssignees)
          .values(allowedIds.map((taskId) => ({ taskId, userId: patch.assigneeId! })))
          .onConflictDoNothing();
        await notify(db, me.id, [patch.assigneeId], { title: `${me.name} assigned you ${allowedIds.length} task${allowedIds.length > 1 ? "s" : ""}`, href: "/my-tasks" });
      }
      for (const t of allowed) await log(db, me.id, "task", t.id, "bulk", patch as Record<string, unknown>);
    }
    done();
    return { count: allowed.length, skipped: rows.length - allowed.length };
  });
}

export async function moveTask(id: string, status: TaskStatus, sortOrder: number) {
  return safe(async () => {
    const me = await actor();
    const { db, t, assignees } = await loadTask(id);
    if (!canWorkOnTask(me, t, assignees)) deny();
    if (status !== t.status && !canEditTask(me, t) && !assignees.includes(me.id)) deny();
    await db
      .update(s.tasks)
      .set({ status, sortOrder, updatedAt: new Date(), ...(status !== t.status ? { completedAt: status === "done" ? new Date() : null } : {}) })
      .where(eq(s.tasks.id, id));
    if (status !== t.status) {
      await log(db, me.id, "task", id, "status", { from: t.status, to: status });
      await notify(db, me.id, [...assignees, t.createdBy], { title: `${me.name} moved ${t.title} to ${statusLabel(status)}`, href: href(t.number) });
    }
    done();
  });
}

export async function deleteTask(id: string) {
  return safe(async () => {
    const me = await actor();
    const { db, t } = await loadTask(id);
    if (!canEditTask(me, t)) deny();
    await db.update(s.tasks).set({ parentId: null }).where(eq(s.tasks.parentId, id));
    await db.delete(s.tasks).where(eq(s.tasks.id, id));
    await log(db, me.id, "task", id, "deleted", { title: t.title, number: t.number });
    done();
  });
}

export async function addDependency(taskId: string, blockedById: string) {
  return safe(async () => {
    const me = await actor();
    if (taskId === blockedById) deny("A task can't block itself.");
    const { db, t } = await loadTask(taskId);
    if (!canEditTask(me, t)) deny();
    await db.insert(s.taskDependencies).values({ taskId, blockedById }).onConflictDoNothing();
    await log(db, me.id, "task", taskId, "dependency", { blockedById });
    done();
  });
}

export async function removeDependency(taskId: string, blockedById: string) {
  return safe(async () => {
    const me = await actor();
    const { db, t } = await loadTask(taskId);
    if (!canEditTask(me, t)) deny();
    await db.delete(s.taskDependencies).where(and(eq(s.taskDependencies.taskId, taskId), eq(s.taskDependencies.blockedById, blockedById)));
    done();
  });
}

export async function addComment(taskId: string, body: string) {
  return safe(async () => {
    const me = await actor();
    const text = z.string().trim().min(1).max(10000).parse(body);
    const { db, t, assignees } = await loadTask(taskId);
    await db.insert(s.comments).values({ taskId, userId: me.id, body: text });
    // @mentions: match "@First" or "@First Last" against people
    const people = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.active, true));
    const mentioned = people.filter((p) => text.toLowerCase().includes("@" + p.name.toLowerCase()) || text.toLowerCase().includes("@" + p.name.split(" ")[0].toLowerCase() + " "));
    await notify(db, me.id, [...assignees, t.createdBy, ...mentioned.map((p) => p.id)], {
      title: `${me.name} commented on ${t.title}`,
      body: text.slice(0, 140),
      href: href(t.number),
    });
    done();
  });
}

export async function deleteComment(id: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [c] = await db.select().from(s.comments).where(eq(s.comments.id, id));
    if (!c) return;
    if (c.userId !== me.id && !me.isAdmin) deny();
    await db.delete(s.comments).where(eq(s.comments.id, id));
    done();
  });
}

export async function logTime(taskId: string, minutes: number, date: string, note?: string) {
  return safe(async () => {
    const me = await actor();
    const m = z.number().int().min(1).max(24 * 60).parse(minutes);
    const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(date);
    const { db, t, assignees } = await loadTask(taskId);
    if (!canWorkOnTask(me, t, assignees)) deny("Only assignees and leads can log time on this task.");
    await db.insert(s.timeEntries).values({ taskId, userId: me.id, minutes: m, date: d, note: note?.trim() || null });
    done();
  });
}

export async function deleteTimeEntry(id: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [e] = await db.select({ e: s.timeEntries, subteamId: s.tasks.subteamId }).from(s.timeEntries).innerJoin(s.tasks, eq(s.tasks.id, s.timeEntries.taskId)).where(eq(s.timeEntries.id, id));
    if (!e) return;
    if (e.e.userId !== me.id && !manages(me, e.subteamId)) deny();
    await db.delete(s.timeEntries).where(eq(s.timeEntries.id, id));
    done();
  });
}

export async function startTimer(taskId: string) {
  return safe(async () => {
    const me = await actor();
    const { db, t, assignees } = await loadTask(taskId);
    if (!canWorkOnTask(me, t, assignees)) deny("Only assignees and leads can track time on this task.");
    await stopTimerFor(me.id);
    await db.insert(s.timers).values({ userId: me.id, taskId, startedAt: new Date() });
    if (t.status === "todo" || t.status === "backlog") {
      await db.update(s.tasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(s.tasks.id, taskId));
      await log(db, me.id, "task", taskId, "status", { from: t.status, to: "in_progress" });
    }
    done();
  });
}

async function stopTimerFor(userId: string) {
  const db = await getDb();
  const [tm] = await db.select().from(s.timers).where(eq(s.timers.userId, userId));
  if (!tm) return 0;
  await db.delete(s.timers).where(eq(s.timers.userId, userId));
  const minutes = Math.max(1, Math.round((Date.now() - tm.startedAt.getTime()) / 60000));
  await db.insert(s.timeEntries).values({
    taskId: tm.taskId,
    userId,
    minutes: Math.min(minutes, 16 * 60),
    date: tm.startedAt.toISOString().slice(0, 10),
    note: "Timer",
  });
  return minutes;
}

export async function stopTimer() {
  return safe(async () => {
    const me = await actor();
    const m = await stopTimerFor(me.id);
    done();
    return m;
  });
}

export async function uploadTaskFile(form: FormData) {
  return safe(async () => {
    const me = await actor();
    const taskId = z.string().uuid().parse(form.get("taskId"));
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) deny("No file selected.");
    if (file.size > 5 * 1024 * 1024) deny("Files must be 5 MB or smaller.");
    const { db, t, assignees } = await loadTask(taskId);
    if (!canWorkOnTask(me, t, assignees)) deny();
    const data = Buffer.from(await file.arrayBuffer());
    await db.insert(s.files).values({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data, taskId, uploadedBy: me.id });
    await log(db, me.id, "task", taskId, "file", { name: file.name });
    done();
  });
}

export async function deleteFile(id: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [f] = await db.select({ id: s.files.id, uploadedBy: s.files.uploadedBy, taskId: s.files.taskId }).from(s.files).where(eq(s.files.id, id));
    if (!f) return;
    if (f.uploadedBy !== me.id && !me.isAdmin) {
      if (!f.taskId) deny();
      const { t } = await loadTask(f.taskId);
      if (!canEditTask(me, t)) deny();
    }
    await db.delete(s.files).where(eq(s.files.id, id));
    done();
  });
}

/* ───────── Detail loader ───────── */

export type TaskDetail = Awaited<ReturnType<typeof getTaskDetailInner>>;

async function getTaskDetailInner(key: string | number) {
  const me = await actor();
  const db = await getDb();
  const [t] = await db
    .select()
    .from(s.tasks)
    .where(typeof key === "number" ? eq(s.tasks.number, key) : eq(s.tasks.id, key));
  if (!t) throw new Error("Task not found");
  const id = t.id;
  const lite = { id: s.tasks.id, number: s.tasks.number, title: s.tasks.title, status: s.tasks.status, subteamId: s.tasks.subteamId };
  const [assignees, subtasks, parent, blockedBy, blocking, comments, acts, time, files, requests, txs, timer] = await Promise.all([
    db.select().from(s.taskAssignees).where(eq(s.taskAssignees.taskId, id)),
    db.select({ ...lite, priority: s.tasks.priority, dueDate: s.tasks.dueDate }).from(s.tasks).where(eq(s.tasks.parentId, id)).orderBy(asc(s.tasks.createdAt)),
    t.parentId ? db.select(lite).from(s.tasks).where(eq(s.tasks.id, t.parentId)) : Promise.resolve([]),
    db.select(lite).from(s.taskDependencies).innerJoin(s.tasks, eq(s.tasks.id, s.taskDependencies.blockedById)).where(eq(s.taskDependencies.taskId, id)),
    db.select(lite).from(s.taskDependencies).innerJoin(s.tasks, eq(s.tasks.id, s.taskDependencies.taskId)).where(eq(s.taskDependencies.blockedById, id)),
    db.select().from(s.comments).where(eq(s.comments.taskId, id)).orderBy(asc(s.comments.createdAt)),
    db.select().from(s.activity).where(and(eq(s.activity.entity, "task"), eq(s.activity.entityId, id))).orderBy(asc(s.activity.createdAt)),
    db.select().from(s.timeEntries).where(eq(s.timeEntries.taskId, id)).orderBy(desc(s.timeEntries.date), desc(s.timeEntries.createdAt)),
    db.select({ id: s.files.id, name: s.files.name, size: s.files.size, mime: s.files.mime, uploadedBy: s.files.uploadedBy, createdAt: s.files.createdAt }).from(s.files).where(eq(s.files.taskId, id)),
    db
      .select({ id: s.purchaseRequests.id, number: s.purchaseRequests.number, title: s.purchaseRequests.title, status: s.purchaseRequests.status, total: s.purchaseRequests.total, requestedBy: s.purchaseRequests.requestedBy })
      .from(s.purchaseRequests)
      .where(eq(s.purchaseRequests.taskId, id)),
    db
      .select({ id: s.transactions.id, description: s.transactions.description, amount: s.transactions.amount, date: s.transactions.date, type: s.transactions.type })
      .from(s.transactions)
      .where(eq(s.transactions.taskId, id)),
    db.select().from(s.timers).where(and(eq(s.timers.userId, me.id), eq(s.timers.taskId, id))),
  ]);
  const assigneeIds = assignees.map((a) => a.userId);
  return {
    task: {
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
    },
    assigneeIds,
    canEdit: canEditTask(me, t),
    canWork: canWorkOnTask(me, t, assigneeIds),
    subtasks,
    parent: parent[0] ?? null,
    blockedBy,
    blocking,
    comments: comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    activity: acts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    time: time.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    files: files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    requests,
    transactions: txs,
    timerStartedAt: timer[0]?.startedAt.toISOString() ?? null,
  };
}

export async function getTaskDetail(key: string | number) {
  return safe(() => getTaskDetailInner(key));
}

export async function searchTasks(q: string) {
  return safe(async () => {
    await actor();
    const db = await getDb();
    const n = Number(q.replace(/^[a-z]{2}-/i, ""));
    return db
      .select({ id: s.tasks.id, number: s.tasks.number, title: s.tasks.title, status: s.tasks.status, subteamId: s.tasks.subteamId })
      .from(s.tasks)
      .where(or(sql`${s.tasks.title} ilike ${"%" + q + "%"}`, Number.isFinite(n) && n > 0 ? eq(s.tasks.number, n) : sql`false`))
      .limit(20);
  });
}
