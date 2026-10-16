"use client";

import * as React from "react";
import { Check, HandCoins, Paperclip } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Avatar, Badge, Button, Empty, useAction } from "@/components/ui";
import { setReimbursement } from "@/lib/actions/finance";
import { isFinance } from "@/lib/perm";
import { cn, money, shortDate } from "@/lib/utils";

type Row = { id: string; description: string; amount: number; date: string; paidBy: string; status: "pending" | "reimbursed"; receiptId: string | null; subteamId: string | null };

export function ReimbursementsClient({ rows, currency }: { rows: Row[]; currency: string }) {
  const { me, person } = useApp();
  const { run, pending } = useAction();
  const fin = isFinance(me);
  const [tab, setTab] = React.useState<"pending" | "reimbursed">("pending");
  const list = rows.filter((r) => r.status === tab);
  const owed = new Map<string, number>();
  for (const r of rows.filter((r) => r.status === "pending")) owed.set(r.paidBy, (owed.get(r.paidBy) ?? 0) + r.amount);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-6">
      {owed.size > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {[...owed].map(([id, amt]) => (
            <div key={id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
              <Avatar id={id} name={person(id)?.name ?? "?"} size={24} />
              <div>
                <div className="text-[13px] font-medium">{person(id)?.name}</div>
                <div className="tabular text-xs text-warn">Owed {money(amt, currency)}</div>
              </div>
              {fin && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    confirm(`Mark all of ${person(id)?.name}'s expenses as reimbursed?`) &&
                    run(() => setReimbursement(rows.filter((r) => r.paidBy === id && r.status === "pending").map((r) => r.id), "reimbursed"), { success: "Marked as reimbursed" })
                  }
                >
                  Settle all
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mb-3 flex rounded-md border border-line bg-surface p-0.5 w-fit">
        {(["pending", "reimbursed"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("h-6 rounded px-2.5 text-[12.5px]", tab === t ? "bg-surface-3 font-medium" : "text-muted hover:text-fg")}>
            {t === "pending" ? "Owed" : "Reimbursed"}
          </button>
        ))}
      </div>
      {!list.length ? (
        <Empty icon={<HandCoins />} title={tab === "pending" ? "Nobody is owed money" : "No reimbursements yet"}>
          When someone pays out of pocket, record the expense with “Paid by” set to them. It shows up here until finance pays them back.
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
              <Avatar id={r.paidBy} name={person(r.paidBy)?.name ?? "?"} size={22} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{r.description}</span>
                <span className="text-xs text-muted">
                  {person(r.paidBy)?.name} · {shortDate(r.date)}
                </span>
              </span>
              {r.receiptId ? (
                <a href={`/api/files/${r.receiptId}`} target="_blank" className="text-subtle hover:text-fg" aria-label="Receipt">
                  <Paperclip className="size-3.5" />
                </a>
              ) : (
                <Badge tone="amber">No receipt</Badge>
              )}
              <span className="tabular w-28 text-right font-medium">{money(r.amount, currency)}</span>
              {fin && tab === "pending" && (
                <Button size="sm" disabled={pending} onClick={() => run(() => setReimbursement([r.id], "reimbursed"), { success: "Marked as reimbursed" })}>
                  <Check />
                  Paid
                </Button>
              )}
              {fin && tab === "reimbursed" && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setReimbursement([r.id], "pending"))}>
                  Undo
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
