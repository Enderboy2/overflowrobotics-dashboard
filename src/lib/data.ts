import "server-only";
import { cache } from "react";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { TaskPriority, TaskStatus } from "@/db/schema";

export type Person = { id: string; name: string; email: string; title: string | null; active: boolean; isAdmin: boolean };
export type Team = { id: string; slug: string; code: string; name: string; color: string; description: string | null };
export type Membership = { userId: string; subteamId: string; role: "head" | "cohead" | "member" };
export type ProjectLite = { id: string; name: string; status: string; subteamId: string | null; targetDate: string | null };

export type Directory = {
  people: Person[];
  teams: Team[];
  memberships: Membership[];
  projects: ProjectLite[];
};

/** Lookup data shared by most pages. */
export const getDirectory = cache(async (): Promise<Directory> => {
  const db = await getDb();
  const [people, teams, memberships, projects] = await Promise.all([
    db
      .select({ id: s.users.id, name: s.users.name, email: s.users.email, title: s.users.title, active: s.users.active, isAdmin: s.users.isAdmin })
      .from(s.users)
      .orderBy(asc(s.users.name)),
    db.select().from(s.subteams).orderBy(asc(s.subteams.sort)),
    db.select().from(s.memberships),
    db
      .select({ id: s.projects.id, name: s.projects.name, status: s.projects.status, subteamId: s.projects.subteamId, targetDate: s.projects.targetDate })
      .from(s.projects)
      .orderBy(asc(s.projects.name)),
  ]);
  return { people, teams, memberships, projects };
});

export type TaskRow = {
  id: string;
  number: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  subteamId: string;
  projectId: string | null;
  parentId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  labels: string[];
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  assigneeIds: string[];
  subtasks: number;
  subtasksDone: number;
  minutes: number;
  openBlockers: number;
};

export const getTaskRows = cache(async (): Promise<TaskRow[]> => {
  const db = await getDb();
  const [tasks, assignees, time, deps] = await Promise.all([
    db.select().from(s.tasks).orderBy(asc(s.tasks.sortOrder), desc(s.tasks.createdAt)),
    db.select().from(s.taskAssignees),
    db
      .select({ taskId: s.timeEntries.taskId, minutes: sql<number>`sum(${s.timeEntries.minutes})::int` })
      .from(s.timeEntries)
      .groupBy(s.timeEntries.taskId),
    db.select().from(s.taskDependencies),
  ]);
  const byTask = new Map<string, string[]>();
  for (const a of assignees) byTask.set(a.taskId, [...(byTask.get(a.taskId) ?? []), a.userId]);
  const mins = new Map(time.map((t) => [t.taskId, t.minutes]));
  const status = new Map(tasks.map((t) => [t.id, t.status]));
  const subs = new Map<string, [number, number]>();
  for (const t of tasks)
    if (t.parentId) {
      const c = subs.get(t.parentId) ?? [0, 0];
      c[0]++;
      if (t.status === "done") c[1]++;
      subs.set(t.parentId, c);
    }
  const blockers = new Map<string, number>();
  for (const d of deps) {
    const st = status.get(d.blockedById);
    if (st && st !== "done" && st !== "cancelled") blockers.set(d.taskId, (blockers.get(d.taskId) ?? 0) + 1);
  }
  return tasks.map((t) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status: t.status,
    priority: t.priority as TaskPriority,
    subteamId: t.subteamId,
    projectId: t.projectId,
    parentId: t.parentId,
    startDate: t.startDate,
    dueDate: t.dueDate,
    estimateHours: t.estimateHours,
    labels: t.labels,
    sortOrder: t.sortOrder,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
    assigneeIds: byTask.get(t.id) ?? [],
    subtasks: subs.get(t.id)?.[0] ?? 0,
    subtasksDone: subs.get(t.id)?.[1] ?? 0,
    minutes: mins.get(t.id) ?? 0,
    openBlockers: blockers.get(t.id) ?? 0,
  }));
});

export async function getRunningTimer(userId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ taskId: s.timers.taskId, startedAt: s.timers.startedAt, number: s.tasks.number, title: s.tasks.title, subteamId: s.tasks.subteamId })
    .from(s.timers)
    .innerJoin(s.tasks, eq(s.tasks.id, s.timers.taskId))
    .where(eq(s.timers.userId, userId));
  return row ? { ...row, startedAt: row.startedAt.toISOString() } : null;
}

export async function getSavedViews(userId: string) {
  const db = await getDb();
  const rows = await db.select().from(s.savedViews).orderBy(asc(s.savedViews.name));
  return rows.filter((v) => v.userId === userId || v.shared).map((v) => ({ id: v.id, name: v.name, config: v.config, shared: v.shared, mine: v.userId === userId }));
}

export async function minutesByUser(userIds: string[], sinceISO: string) {
  if (!userIds.length) return new Map<string, number>();
  const db = await getDb();
  const rows = await db
    .select({ userId: s.timeEntries.userId, minutes: sql<number>`sum(${s.timeEntries.minutes})::int` })
    .from(s.timeEntries)
    .where(sql`${s.timeEntries.date} >= ${sinceISO} and ${inArray(s.timeEntries.userId, userIds)}`)
    .groupBy(s.timeEntries.userId);
  return new Map(rows.map((r) => [r.userId, r.minutes]));
}
