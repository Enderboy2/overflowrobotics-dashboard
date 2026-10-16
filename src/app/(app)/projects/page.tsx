import { getDb, schema as s } from "@/db";
import { requireMe } from "@/lib/auth";
import { getTaskRows } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { ProjectsClient } from "./client";

export const metadata = { title: "Projects" };

export default async function Projects() {
  await requireMe();
  const db = await getDb();
  const [projects, tasks, txs, settings] = await Promise.all([db.select().from(s.projects), getTaskRows(), db.select({ projectId: s.transactions.projectId, amount: s.transactions.amount, type: s.transactions.type }).from(s.transactions), getSettings()]);
  const rows = projects.map((p) => {
    const t = tasks.filter((x) => x.projectId === p.id && x.status !== "cancelled");
    return {
      ...p,
      createdAt: p.createdAt.toISOString(),
      total: t.length,
      done: t.filter((x) => x.status === "done").length,
      overdue: t.filter((x) => x.status !== "done" && x.dueDate && x.dueDate < new Date().toISOString().slice(0, 10)).length,
      spent: txs.filter((x) => x.projectId === p.id && x.type === "expense").reduce((a, x) => a + x.amount, 0),
      people: [...new Set(t.flatMap((x) => x.assigneeIds))],
    };
  });
  return (
    <>
      <PageHeader title="Projects" />
      <ProjectsClient rows={rows} currency={settings.currency} />
    </>
  );
}
