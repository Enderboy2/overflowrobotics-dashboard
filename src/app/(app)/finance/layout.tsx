import { eq } from "drizzle-orm";
import { requireMe } from "@/lib/auth";
import { getDb, schema as s } from "@/db";
import { isFinance, isLead, manages } from "@/lib/perm";
import { PageHeader, Tabs } from "@/components/ui";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const db = await getDb();
  const [media] = await db.select().from(s.subteams).where(eq(s.subteams.slug, "media"));
  const fin = isFinance(me);
  const lead = isLead(me);
  const items = [
    ...(lead ? [{ href: "/finance", label: "Overview", exact: true }] : []),
    ...(lead ? [{ href: "/finance/transactions", label: "Transactions" }] : []),
    { href: "/finance/requests", label: "Purchase requests" },
    { href: "/finance/reimbursements", label: "Reimbursements" },
    ...(fin ? [{ href: "/finance/budgets", label: "Budgets" }] : []),
    ...(fin || (media && manages(me, media.id)) ? [{ href: "/finance/sponsors", label: "Sponsors" }] : []),
  ];
  return (
    <>
      <PageHeader title={lead ? "Finance" : "Purchases"} />
      <Tabs items={items} />
      {children}
    </>
  );
}
