import { requireMe } from "@/lib/auth";
import { getTransactions } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { isFinance } from "@/lib/perm";
import { ReimbursementsClient } from "./client";

export const metadata = { title: "Reimbursements" };

export default async function Page() {
  const me = await requireMe();
  const [txs, settings] = await Promise.all([getTransactions(), getSettings()]);
  const rows = txs.filter((t) => t.paidBy && t.reimbursement !== "none" && (isFinance(me) || t.paidBy === me.id));
  return <ReimbursementsClient rows={rows.map((t) => ({ id: t.id, description: t.description, amount: t.amount, date: t.date, paidBy: t.paidBy!, status: t.reimbursement as "pending" | "reimbursed", receiptId: t.receiptId, subteamId: t.subteamId }))} currency={settings.currency} />;
}
