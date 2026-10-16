"use client";

import { TaskDetailView } from "@/components/task-detail";

export function TaskPage({ number }: { number: number }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-surface">
      <TaskDetailView number={number} />
    </div>
  );
}
