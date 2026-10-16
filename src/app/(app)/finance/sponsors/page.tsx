import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireMe } from "@/lib/auth";
import { getDb, schema as s } from "@/db";
import { getTransactions } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { isFinance, manages } from "@/lib/perm";
import { SponsorsClient } from "./client";

export const metadata = { title: "Sponsors" };

export default async function Page() {
  const me = await requireMe();
  const db = await getDb();
  const [media] = await db.select().from(s.subteams).where(eq(s.subteams.slug, "media"));
  if (!isFinance(me) && !(media && manages(me, media.id))) redirect("/finance");
  const [sponsors, txs, settings] = await Promise.all([db.select().from(s.sponsors), getTransactions(), getSettings()]);
  const received: Record<string, number> = {};
  for (const t of txs) if (t.sponsorId && t.type === "income") received[t.sponsorId] = (received[t.sponsorId] ?? 0) + t.amount;
  return <SponsorsClient sponsors={sponsors.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() }))} received={received} currency={settings.currency} />;
}
