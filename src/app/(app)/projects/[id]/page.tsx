import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireMe } from "@/lib/auth";
import { getDirectory, getTaskRows } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { getActivity } from "@/lib/queries";
import { isFinance, manages } from "@/lib/perm";
import { ProjectClient } from "./client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: (await getDirectory()).projects.find((x) => x.id === id)?.name ?? "Project" };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const [p] = await db.select().from(s.projects).where(eq(s.projects.id, id));
  if (!p) notFound();
  const [tasks, settings] = await Promise.all([getTaskRows(), getSettings()]);
  const seesMoney = isFinance(me) || manages(me, p.subteamId);
  const [txs, requests, events] = await Promise.all([
    seesMoney ? db.select().from(s.transactions).where(eq(s.transactions.projectId, id)).orderBy(desc(s.transactions.date)) : Promise.resolve([]),
    db.select().from(s.purchaseRequests).where(eq(s.purchaseRequests.projectId, id)).orderBy(desc(s.purchaseRequests.createdAt)),
    db.select().from(s.events).where(eq(s.events.projectId, id)).orderBy(s.events.startsAt),
  ]);
  const projectTasks = tasks.filter((t) => t.projectId === id);
  const activity = await getActivity({ entityIds: [id, ...projectTasks.map((t) => t.id)], limit: 20 });
  return (
    <ProjectClient
      project={{ id: p.id, name: p.name, description: p.description, status: p.status, subteamId: p.subteamId, leadId: p.leadId, startDate: p.startDate, targetDate: p.targetDate, budget: p.budget }}
      tasks={tasks}
      seesMoney={seesMoney}
      currency={settings.currency}
      txs={txs.map((t) => ({ id: t.id, description: t.description, amount: t.amount, type: t.type, date: t.date, category: t.category }))}
      requests={requests.map((r) => ({ id: r.id, number: r.number, title: r.title, status: r.status, total: r.total }))}
      events={events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt.toISOString(), type: e.type }))}
      activity={activity}
    />
  );
}
