import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { getDb, schema as s } from "@/db";
import { getTransactions } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { isLead, isFinance } from "@/lib/perm";
import { txVisible } from "@/lib/finance-scope";
import { TransactionsClient } from "./client";

export const metadata = { title: "Transactions" };

export default async function Page() {
  const me = await requireMe();
  if (!isLead(me)) redirect("/finance/requests");
  const db = await getDb();
  const [txs, settings, sponsors, tasks] = await Promise.all([
    getTransactions(),
    getSettings(),
    isFinance(me) ? db.select({ id: s.sponsors.id, name: s.sponsors.name }).from(s.sponsors) : Promise.resolve([]),
    db.select({ id: s.tasks.id, number: s.tasks.number, title: s.tasks.title, subteamId: s.tasks.subteamId }).from(s.tasks),
  ]);
  return (
    <TransactionsClient
      rows={txs.filter(txVisible(me)).map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
      settings={settings}
      sponsors={sponsors}
      tasks={tasks}
    />
  );
}
