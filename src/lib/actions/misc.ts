"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import type { ViewConfig } from "@/db/schema";
import { actor, createSession, deny, destroySession } from "@/lib/auth";
import { isLead, manages } from "@/lib/perm";
import { log } from "@/lib/log";
import { safe } from "@/lib/safe";

const done = () => revalidatePath("/", "layout");
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optStr = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((v) => v || null);

/* ───────── Auth ───────── */

const attempts = new Map<string, { n: number; at: number }>();

export async function login(_: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const a = attempts.get(email);
  if (a && a.n >= 8 && Date.now() - a.at < 10 * 60e3) return { error: "Too many attempts. Try again in a few minutes." };
  const db = await getDb();
  const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
  const ok = u && u.active && (await bcrypt.compare(password, u.passwordHash));
  if (!ok) {
    attempts.set(email, { n: (a?.n ?? 0) + 1, at: Date.now() });
    return { error: "Incorrect email or password." };
  }
  attempts.delete(email);
  await createSession(u.id);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function changePassword(current: string, next: string) {
  return safe(async () => {
    const me = await actor();
    if (next.length < 8) deny("Use at least 8 characters.");
    const db = await getDb();
    const [u] = await db.select().from(s.users).where(eq(s.users.id, me.id));
    if (!me.mustChangePassword && !(await bcrypt.compare(current, u.passwordHash))) deny("Current password is incorrect.");
    await db
      .update(s.users)
      .set({ passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false })
      .where(eq(s.users.id, me.id));
    done();
  });
}

export async function updateProfile(input: { name: string; title?: string | null; phone?: string | null }) {
  return safe(async () => {
    const me = await actor();
    const v = z.object({ name: z.string().trim().min(1).max(80), title: optStr, phone: optStr }).parse(input);
    const db = await getDb();
    await db.update(s.users).set(v).where(eq(s.users.id, me.id));
    done();
  });
}

/* ───────── Notifications ───────── */

export async function markRead(id?: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    await db
      .update(s.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(s.notifications.userId, me.id), isNull(s.notifications.readAt), id ? eq(s.notifications.id, id) : undefined));
    done();
  });
}

/* ───────── Saved views ───────── */

export async function saveView(name: string, config: ViewConfig, shared: boolean) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [v] = await db
      .insert(s.savedViews)
      .values({ userId: me.id, name: z.string().trim().min(1).max(60).parse(name), config, shared: shared && isLead(me) })
      .returning();
    done();
    return v.id;
  });
}

export async function deleteView(id: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    await db.delete(s.savedViews).where(and(eq(s.savedViews.id, id), me.isAdmin ? undefined : eq(s.savedViews.userId, me.id)));
    done();
  });
}

/* ───────── Events ───────── */

const EventInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: optStr,
  type: z.enum(["meeting", "competition", "deadline", "workshop", "testing", "other"]),
  startsAt: z.string(),
  endsAt: z.string().nullish(),
  allDay: z.boolean(),
  location: optStr,
  subteamId: z.string().uuid().nullish(),
  projectId: z.string().uuid().nullish(),
});

export async function saveEvent(id: string | null, input: z.input<typeof EventInput>) {
  return safe(async () => {
    const me = await actor();
    const v = EventInput.parse(input);
    if (v.subteamId ? !manages(me, v.subteamId) : !isLead(me)) deny("Only heads and co-heads can manage events.");
    const db = await getDb();
    const row = {
      ...v,
      subteamId: v.subteamId ?? null,
      projectId: v.projectId ?? null,
      startsAt: new Date(v.startsAt),
      endsAt: v.endsAt ? new Date(v.endsAt) : null,
    };
    if (id) await db.update(s.events).set(row).where(eq(s.events.id, id));
    else await db.insert(s.events).values({ ...row, createdBy: me.id });
    done();
  });
}

export async function deleteEvent(id: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [e] = await db.select().from(s.events).where(eq(s.events.id, id));
    if (!e) return;
    if (e.subteamId ? !manages(me, e.subteamId) : !(me.isAdmin || e.createdBy === me.id)) deny();
    await db.delete(s.events).where(eq(s.events.id, id));
    done();
  });
}

/* ───────── Projects ───────── */

const ProjectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: optStr,
  status: z.enum(["planned", "active", "on_hold", "done"]),
  subteamId: z.string().uuid().nullish(),
  leadId: z.string().uuid().nullish(),
  startDate: DATE.nullish(),
  targetDate: DATE.nullish(),
  budget: z.number().min(0).nullish(),
});

export async function saveProject(id: string | null, input: z.input<typeof ProjectInput>) {
  return safe(async () => {
    const me = await actor();
    const v = ProjectInput.parse(input);
    if (v.subteamId ? !manages(me, v.subteamId) : !me.isAdmin) deny("Cross-team projects can only be managed by admins.");
    const db = await getDb();
    const row = { ...v, subteamId: v.subteamId ?? null, leadId: v.leadId ?? null, startDate: v.startDate ?? null, targetDate: v.targetDate ?? null, budget: v.budget ?? null };
    if (id) {
      const [p] = await db.select().from(s.projects).where(eq(s.projects.id, id));
      if (p?.subteamId ? !manages(me, p.subteamId) : !me.isAdmin) deny();
      await db.update(s.projects).set(row).where(eq(s.projects.id, id));
      await log(db, me.id, "project", id, "updated");
      done();
      return id;
    }
    const [p] = await db.insert(s.projects).values(row).returning();
    await log(db, me.id, "project", p.id, "created", { name: p.name });
    done();
    return p.id;
  });
}

export async function deleteProject(id: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [p] = await db.select().from(s.projects).where(eq(s.projects.id, id));
    if (!p) return;
    if (p.subteamId ? !manages(me, p.subteamId) : !me.isAdmin) deny();
    await db.delete(s.projects).where(eq(s.projects.id, id));
    await log(db, me.id, "project", id, "deleted", { name: p.name });
    done();
  });
}

/* ───────── Inventory ───────── */

const ItemInput = z.object({
  name: z.string().trim().min(1).max(160),
  partNumber: optStr,
  category: optStr,
  subteamId: z.string().uuid().nullish(),
  quantity: z.number().int().min(0),
  minQuantity: z.number().int().min(0),
  unit: optStr,
  location: optStr,
  unitCost: z.number().min(0).nullish(),
  notes: optStr,
});

export async function saveItem(id: string | null, input: z.input<typeof ItemInput>) {
  return safe(async () => {
    const me = await actor();
    const v = ItemInput.parse(input);
    if (v.subteamId ? !manages(me, v.subteamId) : !isLead(me)) deny("Only heads and co-heads can edit inventory.");
    const db = await getDb();
    const row = { ...v, subteamId: v.subteamId ?? null, unitCost: v.unitCost ?? null, updatedAt: new Date() };
    if (id) await db.update(s.inventory).set(row).where(eq(s.inventory.id, id));
    else await db.insert(s.inventory).values(row);
    done();
  });
}

export async function adjustItem(id: string, delta: number) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [it] = await db.select().from(s.inventory).where(eq(s.inventory.id, id));
    if (!it) return;
    // anyone on the team can take parts out / put them back; logged for accountability
    const quantity = Math.max(0, it.quantity + Math.trunc(delta));
    await db.update(s.inventory).set({ quantity, updatedAt: new Date() }).where(eq(s.inventory.id, id));
    await log(db, me.id, "inventory", id, "adjust", { name: it.name, from: it.quantity, to: quantity });
    done();
  });
}

export async function deleteItem(id: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [it] = await db.select().from(s.inventory).where(eq(s.inventory.id, id));
    if (!it) return;
    if (it.subteamId ? !manages(me, it.subteamId) : !me.isAdmin) deny();
    await db.delete(s.inventory).where(eq(s.inventory.id, id));
    done();
  });
}

/* ───────── Command palette data ───────── */

export async function paletteData() {
  return safe(async () => {
    await actor();
    const db = await getDb();
    const tasks = await db
      .select({ id: s.tasks.id, number: s.tasks.number, title: s.tasks.title, status: s.tasks.status, subteamId: s.tasks.subteamId })
      .from(s.tasks)
      .where(ne(s.tasks.status, "cancelled"));
    return tasks;
  });
}
