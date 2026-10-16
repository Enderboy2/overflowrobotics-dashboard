"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useApp } from "@/components/app-context";
import { Avatar, Card, PageHeader, Stat } from "@/components/ui";
import { TaskWorkspace, type SavedView } from "@/components/workspace";
import { BudgetMeter } from "@/components/charts";
import { EVENT_TYPES, ROLE_LABEL, isClosed } from "@/lib/meta";
import { cn, daysUntil, hours, money } from "@/lib/utils";
import type { Team, TaskRow } from "@/lib/data";

export function TeamClient({
  team,
  tasks,
  views,
  events,
  weekMinutes,
  finance,
  currency,
}: {
  team: Team;
  tasks: TaskRow[];
  views: SavedView[];
  events: { id: string; title: string; startsAt: string; type: string; allDay: boolean }[];
  weekMinutes: Record<string, number>;
  finance: { spent: number; budget: number } | null;
  currency: string;
}) {
  const { dir, person } = useApp();
  const rank = { head: 0, cohead: 1, member: 2 };
  const members = dir.memberships
    .filter((m) => m.subteamId === team.id)
    .map((m) => ({ ...m, p: person(m.userId)! }))
    .filter((m) => m.p?.active)
    .sort((a, b) => rank[a.role] - rank[b.role] || a.p.name.localeCompare(b.p.name));
  const tt = tasks.filter((t) => t.subteamId === team.id && t.status !== "cancelled");
  const open = tt.filter((t) => !isClosed(t.status));
  const overdue = open.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const doneWeek = tt.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= weekAgo);
  const unassigned = open.filter((t) => !t.assigneeIds.length);
  const load = members.map((m) => {
    const mine = open.filter((t) => t.assigneeIds.includes(m.userId));
    return { ...m, open: mine.length, est: mine.reduce((a, t) => a + (t.estimateHours ?? 0), 0), overdue: mine.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0).length };
  });
  const maxLoad = Math.max(1, ...load.map((l) => l.open));
  const fmt = (n: number) => money(n, currency, { compact: true });

  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2"><span className="size-2.5 rounded-[3px]" style={{ background: team.color }} />{team.name}</span>} />
      <div className="border-b border-line px-4 py-5 md:px-6">
        {team.description && <p className="mb-4 max-w-2xl text-[13px] text-muted">{team.description}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Open tasks" value={open.length} sub={`${open.filter((t) => t.status === "in_progress").length} in progress`} />
          <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "bad" : undefined} />
          <Stat label="Done, last 7 days" value={doneWeek.length} tone={doneWeek.length ? "ok" : undefined} />
          <Stat label="Unassigned" value={unassigned.length} tone={unassigned.length ? "warn" : undefined} />
          <Stat label="Logged this week" value={hours(Object.values(weekMinutes).reduce((a, b) => a + b, 0))} />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card title={`Members · ${members.length}`}>
            <div className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
              {load.map((m) => (
                <Link key={m.userId} href={`/people/${m.userId}`} className="flex items-center gap-3 rounded-md py-1.5 hover:bg-surface-2/60">
                  <Avatar id={m.userId} name={m.p.name} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">
                      {m.p.name}
                      {m.role !== "member" && <span className="ml-1.5 text-xs font-medium text-muted">{ROLE_LABEL[m.role]}</span>}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span className="block h-full rounded-full" style={{ width: `${(m.open / maxLoad) * 100}%`, background: team.color }} />
                      </span>
                      <span className={cn("tabular w-24 shrink-0 text-right text-[11px]", m.overdue ? "text-bad" : "text-subtle")}>
                        {m.open} open{m.overdue ? ` · ${m.overdue} late` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="tabular hidden w-12 text-right text-[11px] text-subtle sm:block" title="Logged this week">
                    {hours(weekMinutes[m.userId] ?? 0)}
                  </span>
                </Link>
              ))}
              {!members.length && <p className="py-4 text-[13px] text-subtle">No members yet. Admins add people from the Admin page.</p>}
            </div>
          </Card>
          <div className="space-y-4">
            {finance && (
              <Card title="Season budget" action={<Link href={`/finance/transactions?team=${team.id}`} className="text-xs text-muted hover:text-fg">Transactions</Link>}>
                <div className="p-4">
                  <BudgetMeter spent={finance.spent} budget={finance.budget} format={fmt} />
                </div>
              </Card>
            )}
            <Card title="Coming up">
              <ul className="px-4 py-2 text-[13px]">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 py-1">
                    <span className="size-1.5 rounded-full" style={{ background: EVENT_TYPES.find((x) => x.id === e.type)?.color }} />
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                    <span className="text-xs text-muted">{format(new Date(e.startsAt), e.allDay ? "MMM d" : "MMM d, HH:mm")}</span>
                  </li>
                ))}
                {!events.length && <li className="py-2 text-subtle">Nothing scheduled.</li>}
              </ul>
            </Card>
          </div>
        </div>
      </div>
      <TaskWorkspace key={team.id} tasks={tasks} savedViews={views} lock={{ subteam: [team.id] }} syncUrl={false} base={{ layout: "board", groupBy: "status", filters: { showClosed: true } }} createDefaults={{ subteamId: team.id }} />
    </>
  );
}
