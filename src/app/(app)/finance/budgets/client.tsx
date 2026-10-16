"use client";

import * as React from "react";
import { useApp, type Settings } from "@/components/app-context";
import { Button, Dot, useAction } from "@/components/ui";
import { BudgetMeter } from "@/components/charts";
import { saveBudgets } from "@/lib/actions/finance";
import { money } from "@/lib/utils";

export function BudgetsClient({ budgets, spent, settings }: { budgets: { subteamId: string | null; amount: number; notes: string | null }[]; spent: Record<string, number>; settings: Settings }) {
  const { dir } = useApp();
  const { run, pending } = useAction();
  const rows = [...dir.teams.map((t) => ({ id: t.id as string | null, name: t.name, color: t.color })), { id: null, name: "General (travel, fees, shared)", color: "var(--subtle)" }];
  const [vals, setVals] = React.useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.id ?? "general", String(budgets.find((b) => b.subteamId === r.id)?.amount ?? "")])));
  const total = Object.values(vals).reduce((a, v) => a + (Number(v) || 0), 0);
  const totalSpent = Object.values(spent).reduce((a, v) => a + v, 0);
  const fmt = (n: number) => money(n, settings.currency, { compact: true });
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold">Season {settings.season}</h2>
          <p className="text-[13px] text-muted">Spending counts from {settings.seasonStart}. Change the season in Admin settings.</p>
        </div>
        <Button
          variant="primary"
          disabled={pending}
          onClick={() => run(() => saveBudgets(settings.season, rows.map((r) => ({ subteamId: r.id, amount: Number(vals[r.id ?? "general"]) || 0 }))), { success: "Budgets saved" })}
        >
          Save budgets
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {rows.map((r) => {
          const k = r.id ?? "general";
          return (
            <div key={k} className="grid items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[200px_160px_1fr]">
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <Dot color={r.color} />
                {r.name}
              </span>
              <input type="number" min={0} value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} className="input tabular" placeholder="0" aria-label={`${r.name} budget`} />
              <BudgetMeter spent={spent[k] ?? 0} budget={Number(vals[k]) || 0} format={fmt} />
            </div>
          );
        })}
        <div className="grid items-center gap-3 bg-surface-2/50 px-4 py-3 sm:grid-cols-[200px_160px_1fr]">
          <span className="text-[13px] font-semibold">Total</span>
          <span className="tabular px-2.5 text-[13px] font-semibold">{money(total, settings.currency)}</span>
          <BudgetMeter spent={totalSpent} budget={total} format={fmt} />
        </div>
      </div>
    </div>
  );
}
