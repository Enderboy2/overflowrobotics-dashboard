"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Grouped bars per period (e.g. income vs expense per month). One y-axis, hover tooltip, legend. */
export function GroupedBars({
  data,
  series,
  format,
  height = 200,
}: {
  data: { label: string; values: number[] }[];
  series: { name: string; color: string }[];
  format: (n: number) => string;
  height?: number;
}) {
  const axis = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const nice = niceMax(max);
  const ticks = [0, nice / 2, nice];
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="relative flex" style={{ height }}>
        <div className="relative w-10 shrink-0">
          {ticks.map((t) => (
            <span key={t} className="tabular absolute right-2 -translate-y-1/2 text-[10.5px] text-subtle" style={{ top: `${100 - (t / nice) * 100}%` }}>
              {axis(t)}
            </span>
          ))}
        </div>
        <div className="relative flex flex-1 items-end gap-2 border-b border-line-strong">
          {ticks.slice(1).map((t) => (
            <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${100 - (t / nice) * 100}%` }} />
          ))}
          {data.map((d, i) => (
            <div key={d.label} className="relative flex h-full flex-1 items-end justify-center gap-[2px]" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {hover === i && <div className="absolute inset-y-0 -inset-x-1 rounded bg-surface-2" />}
              {d.values.map((v, j) => (
                <div key={j} className="relative w-full max-w-[18px] rounded-t-[4px]" style={{ height: `${(v / nice) * 100}%`, minHeight: v ? 2 : 0, background: series[j].color }} />
              ))}
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 min-w-[150px] rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-pop">
                  <div className="mb-1 font-medium">{d.label}</div>
                  {d.values.map((v, j) => (
                    <div key={j} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-muted">
                        <span className="size-2 rounded-sm" style={{ background: series[j].color }} />
                        {series[j].name}
                      </span>
                      <span className="tabular">{format(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex pl-10">
        <div className="flex flex-1 gap-2">
          {data.map((d) => (
            <div key={d.label} className="flex-1 pt-1.5 text-center text-[10.5px] text-subtle">
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Horizontal bars for a ranked single measure. */
export function HBars({ rows, format, color = "var(--fg)" }: { rows: { label: React.ReactNode; value: number; key: string; sub?: string }[]; format: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-[13px]" title={`${r.sub ?? ""}`}>
          <span className="truncate text-muted">{r.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
          <span className="tabular text-right text-xs">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Budget meter: spent vs budget with over-budget state. */
export function BudgetMeter({ spent, budget, format, className }: { spent: number; budget: number; format: (n: number) => string; className?: string }) {
  const pct = budget ? spent / budget : 0;
  const over = budget > 0 && spent > budget;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full", over ? "bg-bad" : pct > 0.85 ? "bg-warn" : "bg-fg")} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
      <div className="tabular flex justify-between text-xs text-muted">
        <span>
          {format(spent)} of {budget ? format(budget) : "no budget"}
        </span>
        {budget > 0 && <span className={cn(over && "font-medium text-bad")}>{over ? `${format(spent - budget)} over` : `${format(budget - spent)} left`}</span>}
      </div>
    </div>
  );
}
