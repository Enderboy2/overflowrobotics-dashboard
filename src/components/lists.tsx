"use client";

import * as React from "react";
import Link from "next/link";
import { useApp } from "./app-context";
import { useOpenTask } from "./shell";
import { AvatarStack, Badge, Dot, PriorityIcon, StatusIcon, useAction } from "./ui";
import { DueLabel, StatusPicker } from "./task-bits";
import { updateTask } from "@/lib/actions/tasks";
import type { TaskRow } from "@/lib/data";
import { canWorkOnTask } from "@/lib/perm";
import { cn, ago } from "@/lib/utils";
import { isClosed, statusLabel } from "@/lib/meta";
import type { TaskStatus } from "@/db/schema";

/** Compact task rows for dashboards. */
export function TaskMiniList({ rows, empty, showTeam }: { rows: TaskRow[]; empty?: string; showTeam?: boolean }) {
  const { taskKey, person, me, team } = useApp();
  const open = useOpenTask();
  const { run } = useAction();
  const [local, setLocal] = React.useState(rows);
  React.useEffect(() => setLocal(rows), [rows]);
  if (!local.length) return <div className="px-4 py-8 text-center text-[13px] text-subtle">{empty ?? "Nothing here."}</div>;
  return (
    <div>
      {local.map((t) => (
        <div key={t.id} onClick={() => open(t.number)} className="flex h-10 cursor-default items-center gap-2 border-b border-line/70 px-4 text-[13px] last:border-0 hover:bg-surface-2/70">
          <span onClick={(e) => e.stopPropagation()}>
            <StatusPicker
              compact
              value={t.status}
              disabled={!canWorkOnTask(me, t, t.assigneeIds)}
              onChange={(status) => {
                setLocal((l) => l.map((x) => (x.id === t.id ? { ...x, status } : x)));
                run(() => updateTask(t.id, { status }));
              }}
            />
          </span>
          <PriorityIcon priority={t.priority} />
          <span className="hidden w-12 shrink-0 font-mono text-[11px] text-subtle sm:inline">{taskKey(t)}</span>
          <span className={cn("min-w-0 flex-1 truncate", isClosed(t.status) && "text-muted line-through")}>{t.title}</span>
          {t.openBlockers > 0 && <Badge tone="red">Blocked</Badge>}
          {showTeam && <Dot color={team(t.subteamId)?.color ?? "#999"} />}
          <DueLabel date={t.dueDate} status={t.status} />
          <AvatarStack people={t.assigneeIds.map((id) => person(id)).filter(Boolean) as { id: string; name: string }[]} max={2} size={18} />
        </div>
      ))}
    </div>
  );
}

export type ActivityItem = { id: string; actorId: string | null; entity: string; entityId: string; action: string; detail: Record<string, unknown> | null; createdAt: string; ref?: { number: number; title: string; subteamId: string } | null };

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const { person, taskKey } = useApp();
  if (!items.length) return <div className="px-4 py-8 text-center text-[13px] text-subtle">No activity yet.</div>;
  return (
    <ol className="px-4 py-2">
      {items.map((a) => {
        const d = a.detail ?? {};
        let text: React.ReactNode = a.action;
        let href: string | undefined;
        if (a.entity === "task") {
          const name = a.ref ? (
            <>
              <span className="font-mono text-[11px] text-subtle">{taskKey(a.ref)}</span> {a.ref.title}
            </>
          ) : (
            <span className="italic">{String(d.title ?? "a task")}</span>
          );
          href = a.ref ? `?task=${a.ref.number}` : undefined;
          text =
            a.action === "created" ? <>created {name}</> : a.action === "status" ? <>moved {name} to {statusLabel(d.to as TaskStatus)}</> : a.action === "deleted" ? <>deleted {name}</> : a.action === "assignees" ? <>changed assignees on {name}</> : <>updated {name}</>;
        } else if (a.entity === "request") {
          href = "/finance/requests";
          text = <>{a.action === "created" ? "requested a purchase" : `${a.action.replace("_", " ")} a purchase request`}{d.title ? `: ${d.title}` : ""}</>;
        } else if (a.entity === "transaction") {
          href = "/finance/transactions";
          text = <>{a.action} a transaction{d.description ? `: ${d.description}` : ""}</>;
        } else if (a.entity === "project") {
          href = `/projects/${a.entityId}`;
          text = <>{a.action} a project{d.name ? `: ${d.name}` : ""}</>;
        } else if (a.entity === "inventory") {
          href = "/inventory";
          text = <>changed stock of {String(d.name)} from {String(d.from)} to {String(d.to)}</>;
        } else if (a.entity === "user") {
          text = <>{a.action.replace("_", " ")} a member account</>;
        } else text = <>{a.action} {a.entity}</>;
        return (
          <li key={a.id} className="flex gap-2 py-1.5 text-[12.5px] leading-snug">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong" />
            <span className="min-w-0 flex-1 text-muted">
              <span className="font-medium text-fg">{person(a.actorId)?.name ?? "Someone"}</span>{" "}
              {href ? (
                <Link href={href} scroll={false} className="hover:text-fg">
                  {text}
                </Link>
              ) : (
                text
              )}
            </span>
            <span className="shrink-0 text-[11px] text-subtle">{ago(a.createdAt)}</span>
          </li>
        );
      })}
    </ol>
  );
}
