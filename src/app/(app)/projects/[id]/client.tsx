"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, Dot, PageHeader, Stat } from "@/components/ui";
import { ProjectDialog, type ProjectData } from "@/components/forms";
import { TaskWorkspace } from "@/components/workspace";
import { ActivityFeed, type ActivityItem } from "@/components/lists";
import { BudgetMeter } from "@/components/charts";
import { RichText } from "@/components/task-detail";
import { EVENT_TYPES, PROJECT_STATUSES, REQUEST_STATUSES, isClosed } from "@/lib/meta";
import { manages } from "@/lib/perm";
import { daysUntil, hours, longDate, money } from "@/lib/utils";
import type { TaskRow } from "@/lib/data";

export function ProjectClient({
  project: p,
  tasks,
  seesMoney,
  currency,
  txs,
  requests,
  events,
  activity,
}: {
  project: ProjectData;
  tasks: TaskRow[];
  seesMoney: boolean;
  currency: string;
  txs: { id: string; description: string; amount: number; type: string; date: string; category: string }[];
  requests: { id: string; number: number; title: string; status: string; total: number }[];
  events: { id: string; title: string; startsAt: string; type: string }[];
  activity: ActivityItem[];
}) {
  const { me, team, person } = useApp();
  const [edit, setEdit] = React.useState(false);
  const t = team(p.subteamId);
  const mine = tasks.filter((x) => x.projectId === p.id && x.status !== "cancelled");
  const done = mine.filter((x) => x.status === "done").length;
  const open = mine.filter((x) => !isClosed(x.status));
  const overdue = open.filter((x) => x.dueDate && daysUntil(x.dueDate) < 0).length;
  const est = mine.reduce((a, x) => a + (x.estimateHours ?? 0), 0);
  const logged = mine.reduce((a, x) => a + x.minutes, 0);
  const spent = txs.filter((x) => x.type === "expense").reduce((a, x) => a + x.amount, 0);
  const canEdit = p.subteamId ? manages(me, p.subteamId) : me.isAdmin;
  const fmt = (n: number) => money(n, currency, { compact: true });
  return (
    <>
      <PageHeader title={p.name} crumbs={[{ label: "Projects", href: "/projects" }]}>
        {canEdit && (
          <Button size="sm" onClick={() => setEdit(true)}>
            <Pencil />
            Edit
          </Button>
        )}
      </PageHeader>
      <div className="border-b border-line px-4 py-5 md:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
          <Badge tone={p.status === "active" ? "blue" : p.status === "done" ? "green" : p.status === "on_hold" ? "amber" : "gray"}>{PROJECT_STATUSES.find((s) => s.id === p.status)?.label}</Badge>
          <span className="flex items-center gap-1.5">
            {t && <Dot color={t.color} />}
            {t?.name ?? "Cross-team"}
          </span>
          {p.leadId && <span>Lead: {person(p.leadId)?.name}</span>}
          {p.startDate && <span>Started {longDate(p.startDate)}</span>}
          {p.targetDate && <span className={daysUntil(p.targetDate) < 0 && p.status !== "done" ? "text-bad" : ""}>Target {longDate(p.targetDate)}</span>}
        </div>
        {p.description && (
          <div className="mb-4 max-w-3xl text-muted">
            <RichText text={p.description} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Progress" value={`${mine.length ? Math.round((done / mine.length) * 100) : 0}%`} sub={`${done} of ${mine.length} tasks done`} />
          <Stat label="Overdue" value={overdue} tone={overdue ? "bad" : undefined} sub={`${open.length} open`} />
          <Stat label="Time" value={hours(logged)} sub={est ? `of ${est}h estimated` : "No estimates yet"} />
          {seesMoney ? <Stat label="Spent" value={fmt(spent)} sub={p.budget ? `of ${fmt(p.budget)} budget` : "No budget set"} tone={p.budget && spent > p.budget ? "bad" : undefined} /> : <Stat label="Purchase requests" value={requests.length} />}
        </div>
      </div>

      <TaskWorkspace tasks={tasks} lock={{ project: [p.id] }} syncUrl={false} base={{ groupBy: "status", filters: { showClosed: true } }} createDefaults={{ projectId: p.id, subteamId: p.subteamId ?? undefined }} />

      <div className="grid gap-6 px-4 py-6 md:px-6 lg:grid-cols-3">
        {seesMoney && (
          <Card title="Spending">
            <div className="p-4">
              {p.budget ? <BudgetMeter spent={spent} budget={p.budget} format={fmt} className="mb-4" /> : null}
              <ul className="space-y-1.5 text-[13px]">
                {txs.slice(0, 8).map((x) => (
                  <li key={x.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{x.description}</span>
                    <span className="text-xs text-subtle">{format(new Date(x.date), "MMM d")}</span>
                    <span className="tabular text-xs">{money(x.type === "expense" ? -x.amount : x.amount, currency)}</span>
                  </li>
                ))}
                {!txs.length && <li className="text-subtle">No transactions linked yet.</li>}
              </ul>
              {requests.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-1.5 text-xs text-muted">Purchase requests</div>
                  {requests.map((r) => {
                    const st = REQUEST_STATUSES.find((x) => x.id === r.status)!;
                    return (
                      <Link key={r.id} href={`/finance/requests?r=${r.number}`} className="flex items-center gap-2 py-1 text-[13px] hover:underline">
                        <span className="min-w-0 flex-1 truncate">{r.title}</span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        )}
        <Card title="Events">
          <ul className="p-4 text-[13px]">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-1">
                <span className="size-1.5 rounded-full" style={{ background: EVENT_TYPES.find((x) => x.id === e.type)?.color }} />
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
                <span className="text-xs text-muted">{format(new Date(e.startsAt), "MMM d")}</span>
              </li>
            ))}
            {!events.length && <li className="text-subtle">No events linked to this project.</li>}
          </ul>
        </Card>
        <Card title="Activity">
          <ActivityFeed items={activity} />
        </Card>
      </div>
      {edit && <ProjectDialog project={p} open={edit} onOpenChange={setEdit} />}
    </>
  );
}
