import { requireMe } from "@/lib/auth";
import { getTaskRows } from "@/lib/data";
import { getEvents } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { CalendarClient } from "./client";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  await requireMe();
  const [tasks, events] = await Promise.all([getTaskRows(), getEvents()]);
  return (
    <>
      <PageHeader title="Calendar" />
      <CalendarClient tasks={tasks} events={events} />
    </>
  );
}
