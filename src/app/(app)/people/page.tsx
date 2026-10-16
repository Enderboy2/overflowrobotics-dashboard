import { format, startOfMonth } from "date-fns";
import { requireMe } from "@/lib/auth";
import { getDirectory, getTaskRows, minutesByUser } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { PeopleClient } from "./client";

export const metadata = { title: "People" };

export default async function People() {
  await requireMe();
  const [dir, tasks] = await Promise.all([getDirectory(), getTaskRows()]);
  const active = dir.people.filter((p) => p.active);
  const mins = await minutesByUser(active.map((p) => p.id), format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const today = new Date().toISOString().slice(0, 10);
  const stats = Object.fromEntries(
    active.map((p) => {
      const mine = tasks.filter((t) => t.assigneeIds.includes(p.id));
      const open = mine.filter((t) => t.status !== "done" && t.status !== "cancelled");
      return [p.id, { open: open.length, overdue: open.filter((t) => t.dueDate && t.dueDate < today).length, done: mine.filter((t) => t.status === "done").length, minutes: mins.get(p.id) ?? 0, estimate: open.reduce((a, t) => a + (t.estimateHours ?? 0), 0) }];
    }),
  );
  return (
    <>
      <PageHeader title="People" />
      <PeopleClient stats={stats} />
    </>
  );
}
