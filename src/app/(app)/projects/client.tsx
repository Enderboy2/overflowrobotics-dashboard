"use client";

import * as React from "react";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { useApp } from "@/components/app-context";
import { AvatarStack, Badge, Button, Dot, Empty, Progress } from "@/components/ui";
import { ProjectDialog, type ProjectData } from "@/components/forms";
import { PROJECT_STATUSES } from "@/lib/meta";
import { isLead } from "@/lib/perm";
import { cn, daysUntil, money, shortDate } from "@/lib/utils";

type Row = ProjectData & { total: number; done: number; overdue: number; spent: number; people: string[] };

const tone = { planned: "gray", active: "blue", on_hold: "amber", done: "green" } as const;

export function ProjectsClient({ rows, currency }: { rows: Row[]; currency: string }) {
  const { me, team, person } = useApp();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"current" | "done">("current");
  const list = rows.filter((r) => (tab === "done" ? r.status === "done" : r.status !== "done")).sort((a, b) => (a.targetDate ?? "9").localeCompare(b.targetDate ?? "9"));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex rounded-md border border-line bg-surface p-0.5">
          {(["current", "done"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("h-6 rounded px-2.5 text-[12.5px]", tab === t ? "bg-surface-3 font-medium" : "text-muted hover:text-fg")}>
              {t === "current" ? "Current" : "Completed"}
            </button>
          ))}
        </div>
        {isLead(me) && (
          <Button size="sm" variant="primary" className="ml-auto" onClick={() => setOpen(true)}>
            <Plus />
            New project
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <Empty icon={<FolderKanban />} title="No projects here">
          Projects group tasks, spending and events around one goal, like a new frame or the tech documentation.
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="hidden grid-cols-[1fr_120px_160px_110px_140px_90px] gap-4 border-b border-line px-4 py-2 text-xs text-muted lg:grid">
            <span>Project</span>
            <span>Status</span>
            <span>Progress</span>
            <span>Target</span>
            <span>Spent</span>
            <span>People</span>
          </div>
          {list.map((p) => {
            const t = team(p.subteamId);
            const d = p.targetDate ? daysUntil(p.targetDate) : null;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="grid gap-2 border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2/60 lg:grid-cols-[1fr_120px_160px_110px_140px_90px] lg:items-center lg:gap-4">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{p.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    {t ? <Dot color={t.color} /> : null}
                    {t?.name ?? "Cross-team"}
                    {p.leadId && <> · Lead: {person(p.leadId)?.name}</>}
                  </span>
                </span>
                <span>
                  <Badge tone={tone[p.status]}>{PROJECT_STATUSES.find((s) => s.id === p.status)?.label}</Badge>
                </span>
                <span className="flex items-center gap-2">
                  <Progress value={p.total ? p.done / p.total : 0} color={t?.color} />
                  <span className="tabular shrink-0 text-xs text-muted">
                    {p.done}/{p.total}
                  </span>
                </span>
                <span className={cn("text-xs", d !== null && d < 0 && p.status !== "done" ? "text-bad" : "text-muted")}>{p.targetDate ? shortDate(p.targetDate) : "—"}</span>
                <span className="tabular text-xs text-muted">
                  {money(p.spent, currency, { compact: true })}
                  {p.budget ? <span className="text-subtle"> / {money(p.budget, currency, { compact: true })}</span> : null}
                </span>
                <span>
                  <AvatarStack people={p.people.map((id) => person(id)).filter(Boolean) as { id: string; name: string }[]} size={18} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
      {open && <ProjectDialog open={open} onOpenChange={setOpen} />}
    </div>
  );
}
