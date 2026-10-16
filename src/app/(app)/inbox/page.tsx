import { requireMe } from "@/lib/auth";
import { getNotifications } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { InboxList } from "./client";

export const metadata = { title: "Inbox" };

export default async function Inbox() {
  const me = await requireMe();
  const items = await getNotifications(me.id);
  return (
    <>
      <PageHeader title="Inbox" />
      <InboxList items={items} />
    </>
  );
}
