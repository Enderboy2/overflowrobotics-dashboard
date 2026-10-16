"use client";

import * as React from "react";
import * as RD from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleUser, FolderKanban, House, Inbox, Layers, Package, Plus, Receipt, Search, Shield, Users, Wallet, ChartGantt, Settings } from "lucide-react";
import { useApp } from "./app-context";
import { useCreateTask } from "./task-create";
import { Avatar, StatusIcon } from "./ui";
import { paletteData } from "@/lib/actions/misc";
import { cn } from "@/lib/utils";
import { isLead } from "@/lib/perm";
import type { TaskStatus } from "@/db/schema";

type Item = { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void; group: string };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { me, dir, taskKey } = useApp();
  const createTask = useCreateTask();
  const [q, setQ] = React.useState("");
  const [hi, setHi] = React.useState(0);
  const [tasks, setTasks] = React.useState<{ id: string; number: number; title: string; status: TaskStatus; subteamId: string }[]>([]);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setQ("");
    setHi(0);
    paletteData().then((r) => r.ok && setTasks(r.data));
  }, [open]);

  const go = (href: string) => () => {
    onOpenChange(false);
    router.push(href);
  };

  const items: Item[] = React.useMemo(() => {
    const nav: Item[] = [
      { id: "home", label: "Home", icon: <House />, run: go("/"), group: "Go to" },
      { id: "my", label: "My tasks", icon: <CircleUser />, run: go("/my-tasks"), group: "Go to" },
      { id: "inbox", label: "Inbox", icon: <Inbox />, run: go("/inbox"), group: "Go to" },
      { id: "tasks", label: "All tasks", icon: <Layers />, run: go("/tasks"), group: "Go to" },
      { id: "board", label: "Board view", icon: <Layers />, run: go("/tasks?layout=board"), group: "Go to" },
      { id: "projects", label: "Projects", icon: <FolderKanban />, run: go("/projects"), group: "Go to" },
      { id: "timeline", label: "Timeline", icon: <ChartGantt />, run: go("/timeline"), group: "Go to" },
      { id: "calendar", label: "Calendar", icon: <CalendarDays />, run: go("/calendar"), group: "Go to" },
      { id: "people", label: "People", icon: <Users />, run: go("/people"), group: "Go to" },
      { id: "finance", label: "Finance", icon: <Wallet />, run: go("/finance"), group: "Go to" },
      { id: "requests", label: "Purchase requests", icon: <Receipt />, run: go("/finance/requests"), group: "Go to" },
      { id: "inventory", label: "Inventory", icon: <Package />, run: go("/inventory"), group: "Go to" },
      { id: "settings", label: "Settings", icon: <Settings />, run: go("/settings"), group: "Go to" },
      ...(me.isAdmin ? [{ id: "admin", label: "Admin", icon: <Shield />, run: go("/admin"), group: "Go to" }] : []),
      ...dir.teams.map((t) => ({
        id: "team-" + t.id,
        label: t.name,
        hint: "Subteam",
        icon: <span className="size-2.5 rounded-[3px]" style={{ background: t.color }} />,
        run: go(`/teams/${t.slug}`),
        group: "Go to",
      })),
    ];
    const actions: Item[] = [
      ...(isLead(me)
        ? [
            {
              id: "new-task",
              label: "Create task",
              hint: "C",
              icon: <Plus />,
              run: () => {
                onOpenChange(false);
                createTask({});
              },
              group: "Actions",
            },
          ]
        : []),
      { id: "new-pr", label: "Request a purchase", icon: <Receipt />, run: go("/finance/requests?new=1"), group: "Actions" },
    ];
    const people: Item[] = dir.people
      .filter((p) => p.active)
      .map((p) => ({ id: "p-" + p.id, label: p.name, hint: p.title ?? "", icon: <Avatar id={p.id} name={p.name} size={16} />, run: go(`/people/${p.id}`), group: "People" }));
    const projects: Item[] = dir.projects.map((p) => ({ id: "pr-" + p.id, label: p.name, icon: <FolderKanban />, run: go(`/projects/${p.id}`), group: "Projects" }));
    const taskItems: Item[] = tasks.map((t) => ({
      id: "t-" + t.id,
      label: t.title,
      hint: taskKey(t),
      icon: <StatusIcon status={t.status} />,
      run: go(`${location.pathname}?task=${t.number}`),
      group: "Tasks",
    }));
    return [...actions, ...nav, ...taskItems, ...projects, ...people];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, me, dir]);

  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? items.filter((i) => i.label.toLowerCase().includes(ql) || i.hint?.toLowerCase().includes(ql)).slice(0, 60)
    : items.filter((i) => i.group !== "Tasks" && i.group !== "People" && i.group !== "Projects");

  React.useEffect(() => {
    listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  let lastGroup = "";
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="anim-fade fixed inset-0 z-50 bg-black/30 dark:bg-black/50" />
        <RD.Content className="anim-pop fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop outline-none">
          <RD.Title className="sr-only">Search</RD.Title>
          <RD.Description className="sr-only">Search pages, tasks, people and actions</RD.Description>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="size-4 text-subtle" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHi((h) => Math.min(h + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHi((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  filtered[hi]?.run();
                }
              }}
              placeholder="Search tasks, people, projects, or jump to…"
              className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle"
            />
          </div>
          <div ref={listRef} className="max-h-[56vh] overflow-y-auto p-1.5">
            {filtered.map((it, i) => {
              const header = it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              return (
                <React.Fragment key={it.id}>
                  {header && <div className="px-2 pb-1 pt-2.5 text-[11px] font-medium text-subtle">{header}</div>}
                  <button
                    data-i={i}
                    onMouseMove={() => setHi(i)}
                    onClick={it.run}
                    className={cn("flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] [&_svg]:size-4 [&_svg]:text-muted", i === hi && "bg-surface-2")}
                  >
                    <span className="flex w-4 justify-center">{it.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.hint && <span className="font-mono text-[11px] text-subtle">{it.hint}</span>}
                  </button>
                </React.Fragment>
              );
            })}
            {!filtered.length && <div className="px-3 py-8 text-center text-[13px] text-subtle">Nothing matches “{q}”</div>}
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
