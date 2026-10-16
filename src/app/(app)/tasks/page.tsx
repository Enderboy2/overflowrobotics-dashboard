import { requireMe } from "@/lib/auth";
import { getSavedViews, getTaskRows } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { TaskWorkspace } from "@/components/workspace";

export const metadata = { title: "All tasks" };

export default async function TasksPage() {
  const me = await requireMe();
  const [tasks, views] = await Promise.all([getTaskRows(), getSavedViews(me.id)]);
  return (
    <>
      <PageHeader title="All tasks" />
      <TaskWorkspace tasks={tasks} savedViews={views} base={{ filters: { showClosed: true } }} />
    </>
  );
}
