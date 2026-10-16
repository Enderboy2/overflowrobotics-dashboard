import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { ActivityItem } from "@/components/lists";

export async function getActivity(opts: { limit?: number; actorId?: string; entityIds?: string[]; entities?: string[] } = {}): Promise<ActivityItem[]> {
  const db = await getDb();
  const where = and(
    opts.actorId ? eq(s.activity.actorId, opts.actorId) : undefined,
    opts.entityIds ? (opts.entityIds.length ? inArray(s.activity.entityId, opts.entityIds) : sql`false`) : undefined,
    opts.entities ? inArray(s.activity.entity, opts.entities) : undefined,
  );
  const rows = await db
    .select({ a: s.activity, number: s.tasks.number, title: s.tasks.title, subteamId: s.tasks.subteamId })
    .from(s.activity)
    .leftJoin(s.tasks, and(eq(s.activity.entity, "task"), eq(s.tasks.id, s.activity.entityId)))
    .where(where)
    .orderBy(desc(s.activity.createdAt))
    .limit(opts.limit ?? 30);
  return rows.map((r) => ({
    ...r.a,
    detail: r.a.detail ?? null,
    createdAt: r.a.createdAt.toISOString(),
    ref: r.number ? { number: r.number, title: r.title!, subteamId: r.subteamId! } : null,
  }));
}

export async function getEvents(fromISO?: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.events)
    .where(fromISO ? gte(s.events.startsAt, new Date(fromISO)) : undefined)
    .orderBy(s.events.startsAt);
  return rows.map((e) => ({ ...e, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null, createdAt: e.createdAt.toISOString() }));
}
export type EventRow = Awaited<ReturnType<typeof getEvents>>[number];

export async function getTransactions() {
  const db = await getDb();
  return db.select().from(s.transactions).orderBy(desc(s.transactions.date), desc(s.transactions.createdAt));
}
export type TxRow = Awaited<ReturnType<typeof getTransactions>>[number];

export async function getRequests() {
  const db = await getDb();
  const rows = await db.select().from(s.purchaseRequests).orderBy(desc(s.purchaseRequests.createdAt));
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    headApprovedAt: r.headApprovedAt?.toISOString() ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
  }));
}
export type RequestRow = Awaited<ReturnType<typeof getRequests>>[number];

export async function getBudgets(season: string) {
  const db = await getDb();
  return db.select().from(s.budgets).where(eq(s.budgets.season, season));
}

export async function getNotifications(userId: string) {
  const db = await getDb();
  const rows = await db.select().from(s.notifications).where(eq(s.notifications.userId, userId)).orderBy(desc(s.notifications.createdAt)).limit(200);
  return rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null }));
}

export async function unreadCount(userId: string) {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.notifications)
    .where(and(eq(s.notifications.userId, userId), isNull(s.notifications.readAt)));
  return n;
}
