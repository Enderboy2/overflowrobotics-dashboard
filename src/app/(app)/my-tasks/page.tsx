import { requireMe } from "@/lib/auth";
import { getTaskRows } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { TaskWorkspace } from "@/components/workspace";

export const metadata = { title: "My tasks" };

export default async function MyTasks() {
  const me = await requireMe();
  const tasks = await getTaskRows();
  return (
    <>
      <PageHeader title="My tasks" />
      <TaskWorkspace
        tasks={tasks}
        lock={{ assignee: [me.id] }}
        base={{ groupBy: "due", sort: "priority", filters: { showClosed: false } }}
        createDefaults={{ assigneeIds: [me.id] }}
      />
    </>
  );
}
