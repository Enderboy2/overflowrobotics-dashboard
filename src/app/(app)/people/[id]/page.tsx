import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireMe } from "@/lib/auth";
import { getDb, schema as s } from "@/db";
import { getDirectory, getTaskRows } from "@/lib/data";
import { getActivity } from "@/lib/queries";
import { PersonClient } from "./client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: (await getDirectory()).people.find((x) => x.id === id)?.name ?? "Person" };
}

export default async function Person({ params }: { params: Promise<{ id: string }> }) {
  await requireMe();
  const { id } = await params;
  const dir = await getDirectory();
  const p = dir.people.find((x) => x.id === id);
  if (!p) notFound();
  const db = await getDb();
  const [tasks, activity, time, [extra]] = await Promise.all([
    getTaskRows(),
    getActivity({ actorId: id, limit: 20 }),
    db
      .select({ minutes: s.timeEntries.minutes, date: s.timeEntries.date })
      .from(s.timeEntries)
      .where(eq(s.timeEntries.userId, id))
      .orderBy(desc(s.timeEntries.date))
      .limit(500),
    db.select({ phone: s.users.phone, lastSeenAt: s.users.lastSeenAt, createdAt: s.users.createdAt }).from(s.users).where(eq(s.users.id, id)),
  ]);
  return <PersonClient id={id} tasks={tasks} activity={activity} time={time} phone={extra?.phone ?? null} lastSeen={extra?.lastSeenAt?.toISOString() ?? null} />;
}
