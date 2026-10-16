"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Badge, Card, Dot, Stat } from "@/components/ui";
import { BudgetMeter, GroupedBars, HBars } from "@/components/charts";
import { REQUEST_STATUSES, SPONSOR_STATUSES } from "@/lib/meta";
import { money, shortDate } from "@/lib/utils";

type Props = {
  fin: boolean;
  currency: string;
  season: string;
  stats: { balance: number | null; income: number; expense: number; pending: { id: string; number: number; title: string; status: string; total: number; urgent: boolean }[]; owed: number; budget: number };
  monthly: { label: string; values: number[] }[];
  categories: { key: string; label: string; value: number }[];
  budgets: { id: string; name: string; color: string; budget: number; spent: number }[];
  recent: { id: string; description: string; amount: number; type: string; date: string; category: string; subteamId: string | null }[];
  sponsors: { id: string; name: string; status: string; pledged: number; received: number }[];
};

export function Overview({ fin, currency, season, stats, monthly, categories, budgets, recent, sponsors }: Props) {
  const { team } = useApp();
  const fmt = (n: number) => money(n, currency, { compact: true });
  const pendingTotal = stats.pending.reduce((a, r) => a + r.total, 0);
  const pledged = sponsors.filter((s) => s.status !== "declined").reduce((a, s) => a + s.pledged, 0);
  const received = sponsors.reduce((a, s) => a + s.received, 0);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 md:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.balance !== null && <Stat label="Cash balance" value={fmt(stats.balance)} tone={stats.balance < 0 ? "bad" : undefined} sub="All time" />}
        {fin && <Stat label={`Income · ${season}`} value={fmt(stats.income)} />}
        <Stat label={`Spent · ${season}`} value={fmt(stats.expense)} sub={stats.budget ? `${Math.round((stats.expense / stats.budget) * 100)}% of budget` : undefined} />
        <Stat label="Open requests" value={stats.pending.length} sub={fmt(pendingTotal)} tone={stats.pending.length ? "warn" : undefined} />
        <Stat label="Owed to members" value={fmt(stats.owed)} sub="Pending reimbursements" tone={stats.owed ? "warn" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title={fin ? "Cash flow, last 6 months" : "Spending, last 6 months"}>
          <div className="p-4">
            <GroupedBars
              data={fin ? monthly : monthly.map((m) => ({ ...m, values: [m.values[1]] }))}
              series={fin ? [{ name: "Income", color: "var(--chart-1)" }, { name: "Expenses", color: "var(--chart-2)" }] : [{ name: "Expenses", color: "var(--chart-2)" }]}
              format={fmt}
            />
          </div>
        </Card>
        <Card title="Budget vs. spent" action={fin && <Link href="/finance/budgets" className="text-xs text-muted hover:text-fg">Edit budgets</Link>}>
          <div className="space-y-4 p-4">
            {budgets.map((b) => (
              <div key={b.id}>
                <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium">
                  <Dot color={b.color} />
                  {b.name}
                </div>
                <BudgetMeter spent={b.spent} budget={b.budget} format={fmt} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Spending by category">
          <div className="p-4">{categories.length ? <HBars rows={categories} format={fmt} color="var(--chart-2)" /> : <p className="text-[13px] text-subtle">No expenses this season.</p>}</div>
        </Card>
        <Card title="Awaiting action" action={<Link href="/finance/requests" className="flex items-center gap-1 text-xs text-muted hover:text-fg">All requests <ArrowUpRight className="size-3" /></Link>}>
          <div className="divide-y divide-line">
            {stats.pending.slice(0, 6).map((r) => {
              const st = REQUEST_STATUSES.find((x) => x.id === r.status)!;
              return (
                <Link key={r.id} href={`/finance/requests?r=${r.number}`} className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-surface-2/60">
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="tabular w-16 text-right text-xs text-muted">{fmt(r.total)}</span>
                </Link>
              );
            })}
            {!stats.pending.length && <p className="px-4 py-6 text-center text-[13px] text-subtle">Nothing waiting.</p>}
          </div>
        </Card>
        <Card title="Recent transactions" action={<Link href="/finance/transactions" className="flex items-center gap-1 text-xs text-muted hover:text-fg">All <ArrowUpRight className="size-3" /></Link>}>
          <div className="divide-y divide-line">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
                {t.subteamId ? <Dot color={team(t.subteamId)?.color ?? "#999"} /> : <span className="size-2" />}
                <span className="min-w-0 flex-1 truncate">{t.description}</span>
                <span className="text-xs text-subtle">{shortDate(t.date)}</span>
                <span className={`tabular w-20 text-right text-xs ${t.type === "income" ? "text-ok" : ""}`}>{money(t.type === "income" ? t.amount : -t.amount, currency, { compact: true, sign: true })}</span>
              </div>
            ))}
            {!recent.length && <p className="px-4 py-6 text-center text-[13px] text-subtle">No transactions yet.</p>}
          </div>
        </Card>
      </div>

      {fin && sponsors.length > 0 && (
        <Card title="Sponsorship" action={<Link href="/finance/sponsors" className="text-xs text-muted hover:text-fg">Manage</Link>}>
          <div className="grid gap-4 p-4 sm:grid-cols-[220px_1fr]">
            <div>
              <div className="text-xs text-muted">Received / pledged</div>
              <div className="tabular mt-1 text-xl font-semibold">{fmt(received)}</div>
              <div className="tabular text-xs text-subtle">of {fmt(pledged)} pledged</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SPONSOR_STATUSES.map((st) => {
                const n = sponsors.filter((s) => s.status === st.id).length;
                return (
                  <div key={st.id} className="min-w-[110px] flex-1 rounded-md border border-line px-3 py-2">
                    <div className="text-xs text-muted">{st.label}</div>
                    <div className="tabular text-lg font-semibold">{n}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
