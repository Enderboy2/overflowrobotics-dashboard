"use client";

import * as React from "react";
import { Handshake, Plus } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Avatar, Badge, Button, Empty, Progress } from "@/components/ui";
import { SponsorDialog, type SponsorData } from "@/components/finance-forms";
import { SPONSOR_STATUSES } from "@/lib/meta";
import { cn, daysUntil, money, shortDate } from "@/lib/utils";

export function SponsorsClient({ sponsors, received, currency }: { sponsors: SponsorData[]; received: Record<string, number>; currency: string }) {
  const { person } = useApp();
  const [edit, setEdit] = React.useState<SponsorData | "new" | null>(null);
  const [view, setView] = React.useState<"pipeline" | "table">("pipeline");
  const fmt = (n: number) => money(n, currency, { compact: true });
  const followUps = sponsors.filter((s) => s.nextFollowUp && !["declined"].includes(s.status) && daysUntil(s.nextFollowUp) <= 3).sort((a, b) => a.nextFollowUp!.localeCompare(b.nextFollowUp!));
  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex rounded-md border border-line bg-surface p-0.5">
          {(["pipeline", "table"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("h-6 rounded px-2.5 text-[12.5px] capitalize", view === v ? "bg-surface-3 font-medium" : "text-muted hover:text-fg")}>
              {v}
            </button>
          ))}
        </div>
        {followUps.length > 0 && (
          <span className="text-[13px] text-warn">
            {followUps.length} follow-up{followUps.length > 1 ? "s" : ""} due: {followUps.map((s) => s.name).join(", ")}
          </span>
        )}
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => setEdit("new")}>
          <Plus />
          Add sponsor
        </Button>
      </div>
      {!sponsors.length ? (
        <Empty icon={<Handshake />} title="No sponsors yet">
          Track every company from first contact to payment. Payments recorded as income and linked to a sponsor count as received here.
        </Empty>
      ) : view === "pipeline" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {SPONSOR_STATUSES.map((st) => {
            const list = sponsors.filter((s) => s.status === st.id);
            return (
              <div key={st.id} className="w-64 shrink-0 rounded-lg bg-surface-2/60">
                <div className="flex h-10 items-center gap-2 px-3 text-[13px] font-medium">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="text-subtle">{list.length}</span>
                  <span className="tabular ml-auto text-xs font-normal text-muted">{fmt(list.reduce((a, s) => a + s.pledged, 0))}</span>
                </div>
                <div className="space-y-1.5 px-1.5 pb-2">
                  {list.map((s) => (
                    <SponsorCard key={s.id} s={s} received={received[s.id] ?? 0} fmt={fmt} onClick={() => setEdit(s)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-normal">Sponsor</th>
                <th className="px-2 py-2 font-normal">Status</th>
                <th className="px-2 py-2 font-normal">Owner</th>
                <th className="px-2 py-2 font-normal">Follow-up</th>
                <th className="px-2 py-2 text-right font-normal">Pledged</th>
                <th className="px-4 py-2 text-right font-normal">Received</th>
              </tr>
            </thead>
            <tbody>
              {sponsors.map((s) => {
                const st = SPONSOR_STATUSES.find((x) => x.id === s.status)!;
                return (
                  <tr key={s.id} onClick={() => setEdit(s)} className="border-b border-line/70 last:border-0 hover:bg-surface-2/60">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted">{[s.tier, s.inKind].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-muted">{person(s.ownerId)?.name ?? "—"}</td>
                    <td className={cn("px-2 py-2.5 text-xs", s.nextFollowUp && daysUntil(s.nextFollowUp) < 0 ? "text-bad" : "text-muted")}>{s.nextFollowUp ? shortDate(s.nextFollowUp) : "—"}</td>
                    <td className="tabular px-2 py-2.5 text-right">{money(s.pledged, currency)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{money(received[s.id] ?? 0, currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <SponsorDialog sponsor={edit === "new" ? undefined : edit} currency={currency} onClose={() => setEdit(null)} />}
    </div>
  );
}

function SponsorCard({ s, received, fmt, onClick }: { s: SponsorData; received: number; fmt: (n: number) => string; onClick: () => void }) {
  const { person } = useApp();
  const owner = person(s.ownerId);
  const late = s.nextFollowUp && daysUntil(s.nextFollowUp) < 0;
  return (
    <button onClick={onClick} className="w-full rounded-md border border-line bg-surface p-2.5 text-left hover:border-line-strong">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{s.name}</span>
        {owner && <Avatar id={owner.id} name={owner.name} size={18} />}
      </div>
      {(s.tier || s.inKind) && <div className="mt-0.5 truncate text-xs text-muted">{[s.tier, s.inKind].filter(Boolean).join(" · ")}</div>}
      {s.pledged > 0 && (
        <div className="mt-2">
          <Progress value={received / s.pledged} color="var(--chart-1)" />
          <div className="tabular mt-1 text-[11px] text-muted">
            {fmt(received)} of {fmt(s.pledged)}
          </div>
        </div>
      )}
      {s.nextFollowUp && <div className={cn("mt-1.5 text-[11px]", late ? "text-bad" : "text-subtle")}>Follow up {shortDate(s.nextFollowUp)}</div>}
    </button>
  );
}
