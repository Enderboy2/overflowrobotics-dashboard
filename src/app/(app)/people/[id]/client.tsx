"use client";

import { eachDayOfInterval, format, subDays } from "date-fns";
import { Mail, Phone } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Avatar, Card, Dot, PageHeader, Stat } from "@/components/ui";
import { TaskWorkspace } from "@/components/workspace";
import { ActivityFeed, type ActivityItem } from "@/components/lists";
import { ROLE_LABEL, isClosed } from "@/lib/meta";
import { ago, hours } from "@/lib/utils";
import type { TaskRow } from "@/lib/data";

export function PersonClient({ id, tasks, activity, time, phone, lastSeen }: { id: string; tasks: TaskRow[]; activity: ActivityItem[]; time: { minutes: number; date: string }[]; phone: string | null; lastSeen: string | null }) {
  const { person, dir } = useApp();
  const p = person(id)!;
  const ms = dir.memberships.filter((m) => m.userId === id);
  const mine = tasks.filter((t) => t.assigneeIds.includes(id));
  const open = mine.filter((t) => !isClosed(t.status));
  const today = new Date().toISOString().slice(0, 10);
  const days = eachDayOfInterval({ start: subDays(new Date(), 83), end: new Date() });
  const byDay = new Map<string, number>();
  for (const e of time) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.minutes);
  const max = Math.max(60, ...byDay.values());
  const total28 = days.slice(-28).reduce((a, d) => a + (byDay.get(format(d, "yyyy-MM-dd")) ?? 0), 0);
  return (
    <>
      <PageHeader title={p.name} crumbs={[{ label: "People", href: "/people" }]} />
      <div className="border-b border-line px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar id={p.id} name={p.name} size={52} />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">{p.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
              {p.title && <span>{p.title}</span>}
              {ms.map((m) => {
                const t = dir.teams.find((x) => x.id === m.subteamId)!;
                return (
                  <span key={m.subteamId} className="flex items-center gap-1.5">
                    <Dot color={t.color} />
                    {t.name} {ROLE_LABEL[m.role]}
                  </span>
                );
              })}
              <a href={`mailto:${p.email}`} className="flex items-center gap-1 hover:text-fg">
                <Mail className="size-3.5" />
                {p.email}
              </a>
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-1 hover:text-fg">
                  <Phone className="size-3.5" />
                  {phone}
                </a>
              )}
              {lastSeen && <span className="text-subtle">Active {ago(lastSeen)}</span>}
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Open tasks" value={open.length} />
          <Stat label="Overdue" value={open.filter((t) => t.dueDate && t.dueDate < today).length} tone={open.some((t) => t.dueDate && t.dueDate < today) ? "bad" : undefined} />
          <Stat label="Completed" value={mine.filter((t) => t.status === "done").length} />
          <Stat label="Logged, last 28 days" value={hours(total28)} />
        </div>
        <div className="mt-5">
          <div className="mb-2 text-xs text-muted">Time logged, last 12 weeks</div>
          <div className="grid w-fit grid-flow-col grid-rows-7 gap-[3px]">
            {days.map((d) => {
              const k = format(d, "yyyy-MM-dd");
              const m = byDay.get(k) ?? 0;
              return <span key={k} title={`${format(d, "EEE, MMM d")}: ${hours(m)}`} className="size-3 rounded-[3px]" style={{ background: m ? `color-mix(in srgb, var(--chart-1) ${25 + (m / max) * 75}%, transparent)` : "var(--surface-3)" }} />;
            })}
          </div>
        </div>
      </div>
      <TaskWorkspace tasks={tasks} lock={{ assignee: [id] }} syncUrl={false} base={{ groupBy: "status", sort: "due", filters: { showClosed: false } }} createDefaults={{ assigneeIds: [id] }} />
      <div className="px-4 py-6 md:px-6">
        <Card title="Recent activity" className="max-w-3xl">
          <ActivityFeed items={activity} />
        </Card>
      </div>
    </>
  );
}
