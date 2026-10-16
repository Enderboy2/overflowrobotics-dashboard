import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { getBudgets, getTransactions } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { isFinance } from "@/lib/perm";
import { BudgetsClient } from "./client";

export const metadata = { title: "Budgets" };

export default async function Page() {
  const me = await requireMe();
  if (!isFinance(me)) redirect("/finance");
  const settings = await getSettings();
  const [budgets, txs] = await Promise.all([getBudgets(settings.season), getTransactions()]);
  const spent: Record<string, number> = {};
  for (const t of txs) if (t.type === "expense" && t.date >= settings.seasonStart) spent[t.subteamId ?? "general"] = (spent[t.subteamId ?? "general"] ?? 0) + t.amount;
  return <BudgetsClient budgets={budgets.map((b) => ({ subteamId: b.subteamId, amount: b.amount, notes: b.notes }))} spent={spent} settings={settings} />;
}
