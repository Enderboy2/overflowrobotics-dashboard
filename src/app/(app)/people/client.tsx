"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Avatar, Badge, Chip, Dot } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/meta";
import { cn, hours } from "@/lib/utils";

type Stats = Record<string, { open: number; overdue: number; done: number; minutes: number; estimate: number }>;

export function PeopleClient({ stats }: { stats: Stats }) {
  const { dir, activePeople } = useApp();
  const [team, setTeam] = React.useState("all");
  const [q, setQ] = React.useState("");
  const rank = { head: 0, cohead: 1, member: 2 };
  const rows = activePeople
    .map((p) => ({ p, ms: dir.memberships.filter((m) => m.userId === p.id) }))
    .filter(({ p, ms }) => (team === "all" || ms.some((m) => m.subteamId === team)) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Math.min(...a.ms.map((m) => rank[m.role]), 3) - Math.min(...b.ms.map((m) => rank[m.role]), 3) || a.p.name.localeCompare(b.p.name));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Chip active={team === "all"} onClick={() => setTeam("all")}>
          Everyone <span className="text-subtle">{activePeople.length}</span>
        </Chip>
        {dir.teams.map((t) => (
          <Chip key={t.id} active={team === t.id} onClick={() => setTeam(t.id)}>
            <Dot color={t.color} />
            {t.name}
            <span className="text-subtle">{dir.memberships.filter((m) => m.subteamId === t.id).length}</span>
          </Chip>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="h-7 w-48 rounded-md border border-line bg-surface pl-7 pr-2 text-[12.5px] outline-none placeholder:text-subtle" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="hidden grid-cols-[1fr_220px_80px_80px_100px_100px] gap-4 border-b border-line px-4 py-2 text-xs text-muted md:grid">
          <span>Name</span>
          <span>Subteam</span>
          <span className="text-right">Open</span>
          <span className="text-right">Overdue</span>
          <span className="text-right">Workload</span>
          <span className="text-right">This month</span>
        </div>
        {rows.map(({ p, ms }) => {
          const s = stats[p.id];
          return (
            <Link key={p.id} href={`/people/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-4 py-2.5 last:border-0 hover:bg-surface-2/60 md:grid-cols-[1fr_220px_80px_80px_100px_100px]">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar id={p.id} name={p.name} size={28} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[13px] font-medium">
                    <span className="truncate">{p.name}</span>
                    {p.isAdmin && <Badge>Admin</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted">{p.title ?? p.email}</span>
                </span>
              </span>
              <span className="hidden flex-wrap gap-x-3 gap-y-1 text-xs md:flex">
                {ms.map((m) => {
                  const t = dir.teams.find((x) => x.id === m.subteamId)!;
                  return (
                    <span key={m.subteamId} className="flex items-center gap-1.5 text-muted">
                      <Dot color={t.color} />
                      {t.name}
                      {m.role !== "member" && <span className="font-medium text-fg">· {ROLE_LABEL[m.role]}</span>}
                    </span>
                  );
                })}
              </span>
              <span className="tabular text-right text-[13px]">{s?.open ?? 0}</span>
              <span className={cn("tabular hidden text-right text-[13px] md:block", s?.overdue ? "text-bad" : "text-subtle")}>{s?.overdue ?? 0}</span>
              <span className="tabular hidden text-right text-xs text-muted md:block">{s?.estimate ? `${s.estimate}h est.` : "—"}</span>
              <span className="tabular hidden text-right text-xs text-muted md:block">{hours(s?.minutes ?? 0)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
