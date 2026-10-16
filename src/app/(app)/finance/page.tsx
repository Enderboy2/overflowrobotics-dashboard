import { redirect } from "next/navigation";
import { format, startOfMonth, subMonths } from "date-fns";
import { requireMe } from "@/lib/auth";
import { getDirectory } from "@/lib/data";
import { getBudgets, getRequests, getTransactions } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { getDb, schema as s } from "@/db";
import { isFinance, isLead } from "@/lib/perm";
import { requestVisible, txVisible } from "@/lib/finance-scope";
import { Overview } from "./overview";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  const me = await requireMe();
  if (!isLead(me)) redirect("/finance/requests");
  const fin = isFinance(me);
  const settings = await getSettings();
  const db = await getDb();
  const [allTx, budgets, requests, dir, sponsors] = await Promise.all([getTransactions(), getBudgets(settings.season), getRequests(), getDirectory(), fin ? db.select().from(s.sponsors) : Promise.resolve([])]);
  const txs = allTx.filter(txVisible(me));
  const season = txs.filter((t) => t.date >= settings.seasonStart);
  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
  const monthly = months.map((m) => {
    const k = format(m, "yyyy-MM");
    const inMonth = txs.filter((t) => t.date.startsWith(k));
    return { label: format(m, "MMM"), values: [inMonth.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0), inMonth.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0)] };
  });
  const byCat = new Map<string, number>();
  for (const t of season.filter((t) => t.type === "expense")) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  const teams = fin ? dir.teams : dir.teams.filter((t) => me.memberships.some((m) => m.subteamId === t.id && m.role !== "member"));
  const budgetRows = [
    ...teams.map((t) => ({ id: t.id, name: t.name, color: t.color, budget: budgets.find((b) => b.subteamId === t.id)?.amount ?? 0, spent: season.filter((x) => x.type === "expense" && x.subteamId === t.id).reduce((a, x) => a + x.amount, 0) })),
    ...(fin ? [{ id: "general", name: "General", color: "var(--subtle)", budget: budgets.find((b) => !b.subteamId)?.amount ?? 0, spent: season.filter((x) => x.type === "expense" && !x.subteamId).reduce((a, x) => a + x.amount, 0) }] : []),
  ];
  const visibleReq = requests.filter(requestVisible(me));
  const received = new Map<string, number>();
  for (const t of allTx) if (t.sponsorId && t.type === "income") received.set(t.sponsorId, (received.get(t.sponsorId) ?? 0) + t.amount);
  return (
    <Overview
      fin={fin}
      currency={settings.currency}
      season={settings.season}
      stats={{
        balance: fin ? allTx.reduce((a, t) => a + (t.type === "income" ? t.amount : -t.amount), 0) : null,
        income: season.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0),
        expense: season.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0),
        pending: visibleReq.filter((r) => ["pending", "head_approved", "approved"].includes(r.status)),
        owed: txs.filter((t) => t.reimbursement === "pending").reduce((a, t) => a + t.amount, 0),
        budget: budgetRows.reduce((a, b) => a + b.budget, 0),
      }}
      monthly={monthly}
      categories={[...byCat].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: k, value: v }))}
      budgets={budgetRows}
      recent={txs.slice(0, 8).map((t) => ({ id: t.id, description: t.description, amount: t.amount, type: t.type, date: t.date, category: t.category, subteamId: t.subteamId }))}
      sponsors={sponsors.map((sp) => ({ id: sp.id, name: sp.name, status: sp.status, pledged: sp.pledged, received: received.get(sp.id) ?? 0 }))}
    />
  );
}
