"use client";

import * as React from "react";
import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useApp } from "./app-context";
import { Button, Chip, IconButton, Toggle, useAction } from "./ui";
import { AssigneePicker, DateChip, LabelPicker, PriorityPicker, ProjectPicker, StatusPicker, TeamPicker } from "./task-bits";
import { createTask } from "@/lib/actions/tasks";
import { managedSubteams } from "@/lib/perm";
import type { TaskPriority, TaskStatus } from "@/db/schema";

type Defaults = {
  subteamId?: string;
  projectId?: string | null;
  parentId?: string | null;
  parentLabel?: string;
  status?: TaskStatus;
  assigneeIds?: string[];
  dueDate?: string | null;
  priority?: TaskPriority;
  onCreated?: () => void;
};

const Ctx = React.createContext<(d: Defaults) => void>(() => {});
export const useCreateTask = () => React.useContext(Ctx);

export function CreateTaskProvider({ children }: { children: React.ReactNode }) {
  const [defaults, setDefaults] = React.useState<Defaults | null>(null);
  const open = React.useCallback((d: Defaults) => setDefaults(d), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {defaults && <CreateTaskDialog defaults={defaults} onClose={() => setDefaults(null)} />}
    </Ctx.Provider>
  );
}

function CreateTaskDialog({ defaults, onClose }: { defaults: Defaults; onClose: () => void }) {
  const { me, dir } = useApp();
  const { run, pending } = useAction();
  const allowed = me.isAdmin ? dir.teams.map((t) => t.id) : managedSubteams(me);
  const initialTeam = defaults.subteamId ?? allowed[0] ?? me.memberships[0]?.subteamId ?? dir.teams[0]?.id;
  const blank = () => ({
    title: "",
    description: "",
    subteamId: initialTeam,
    projectId: defaults.projectId ?? null,
    status: defaults.status ?? ("todo" as TaskStatus),
    priority: defaults.priority ?? (0 as TaskPriority),
    assigneeIds: defaults.assigneeIds ?? [],
    dueDate: defaults.dueDate ?? null,
    startDate: null as string | null,
    labels: [] as string[],
    estimateHours: null as number | null,
  });
  const [f, setF] = React.useState(blank);
  const [more, setMore] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = () => {
    if (!f.title.trim()) return titleRef.current?.focus();
    run(() => createTask({ ...f, parentId: defaults.parentId ?? null }), {
      then: (r) => {
        if (!r.ok) return;
        defaults.onCreated?.();
        if (more) {
          setF((x) => ({ ...blank(), subteamId: x.subteamId, projectId: x.projectId, assigneeIds: x.assigneeIds }));
          titleRef.current?.focus();
        } else onClose();
      },
      success: "Task created",
    });
  };

  return (
    <RD.Root open onOpenChange={(v) => !v && onClose()}>
      <RD.Portal>
        <RD.Overlay className="anim-fade fixed inset-0 z-50 bg-black/30 dark:bg-black/50" />
        <RD.Content
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          className="anim-pop fixed left-1/2 top-[10vh] z-50 w-[calc(100vw-24px)] max-w-2xl -translate-x-1/2 rounded-xl border border-line bg-surface shadow-pop outline-none"
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <RD.Title className="flex items-center gap-1.5 text-xs text-muted">
              {defaults.parentLabel ? <>New subtask of {defaults.parentLabel}</> : "New task"}
            </RD.Title>
            <RD.Description className="sr-only">Create a task</RD.Description>
            <RD.Close asChild>
              <IconButton label="Close">
                <X />
              </IconButton>
            </RD.Close>
          </div>
          <div className="px-4 pb-2">
            <input
              ref={titleRef}
              autoFocus
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Task title"
              className="w-full bg-transparent py-2 text-lg font-medium outline-none placeholder:text-subtle"
            />
            <textarea
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Add details, acceptance criteria, links…"
              rows={4}
              className="w-full resize-none bg-transparent text-[13.5px] leading-relaxed outline-none placeholder:text-subtle"
            />
            <div className="flex flex-wrap gap-1.5 pb-2 pt-1">
              <StatusPicker value={f.status} onChange={(v) => set("status", v)} />
              <PriorityPicker value={f.priority} onChange={(v) => set("priority", v)} />
              <AssigneePicker value={f.assigneeIds} onChange={(v) => set("assigneeIds", v)} subteamId={f.subteamId} />
              <TeamPicker value={f.subteamId} onChange={(v) => set("subteamId", v)} only={defaults.parentId ? undefined : allowed} disabled={!!defaults.parentId} />
              <ProjectPicker value={f.projectId} onChange={(v) => set("projectId", v)} />
              <DateChip value={f.startDate} onChange={(v) => set("startDate", v)} placeholder="Start" />
              <DateChip value={f.dueDate} onChange={(v) => set("dueDate", v)} placeholder="Due date" />
              <LabelPicker value={f.labels} onChange={(v) => set("labels", v)} />
              <Chip className="w-[118px] pr-1">
                <span className="text-subtle">Est.</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={f.estimateHours ?? ""}
                  onChange={(e) => set("estimateHours", e.target.value === "" ? null : Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="—"
                  className="w-10 bg-transparent text-fg outline-none"
                />
                <span className="text-subtle">h</span>
              </Chip>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
            <Toggle checked={more} onChange={setMore} label="Create more" />
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-subtle sm:inline">⌘ Enter</span>
              <Button variant="primary" onClick={submit} disabled={pending}>
                Create task
              </Button>
            </div>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
