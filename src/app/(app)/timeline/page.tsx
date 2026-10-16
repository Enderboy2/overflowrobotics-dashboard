import { requireMe } from "@/lib/auth";
import { getSavedViews, getTaskRows } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { TaskWorkspace } from "@/components/workspace";

export const metadata = { title: "Timeline" };

export default async function TimelinePage() {
  const me = await requireMe();
  const [tasks, views] = await Promise.all([getTaskRows(), getSavedViews(me.id)]);
  return (
    <>
      <PageHeader title="Timeline" />
      <TaskWorkspace tasks={tasks} savedViews={views} layouts={["timeline", "list"]} base={{ layout: "timeline", groupBy: "project", sort: "due", filters: { showClosed: false } }} />
    </>
  );
}
