import { notFound } from "next/navigation";
import { format, startOfWeek, subDays } from "date-fns";
import { requireMe } from "@/lib/auth";
import { getDirectory, getSavedViews, getTaskRows, minutesByUser } from "@/lib/data";
import { getBudgets, getEvents, getTransactions } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { isFinance, manages } from "@/lib/perm";
import { TeamClient } from "./client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = (await getDirectory()).teams.find((x) => x.slug === slug);
  return { title: t?.name ?? "Subteam" };
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const me = await requireMe();
  const { slug } = await params;
  const dir = await getDirectory();
  const team = dir.teams.find((t) => t.slug === slug);
  if (!team) notFound();
  const memberIds = dir.memberships.filter((m) => m.subteamId === team.id).map((m) => m.userId);
  const [tasks, events, settings, views, weekMins] = await Promise.all([
    getTaskRows(),
    getEvents(subDays(new Date(), 1).toISOString()),
    getSettings(),
    getSavedViews(me.id),
    minutesByUser(memberIds, format(startOfWeek(new Date(), { weekStartsOn: 6 }), "yyyy-MM-dd")),
  ]);
  const seesMoney = isFinance(me) || manages(me, team.id);
  let finance = null;
  if (seesMoney) {
    const [txs, budgets] = await Promise.all([getTransactions(), getBudgets(settings.season)]);
    const spent = txs.filter((t) => t.subteamId === team.id && t.type === "expense" && t.date >= settings.seasonStart).reduce((a, t) => a + t.amount, 0);
    finance = { spent, budget: budgets.find((b) => b.subteamId === team.id)?.amount ?? 0 };
  }
  return (
    <TeamClient
      team={team}
      tasks={tasks}
      views={views}
      events={events.filter((e) => !e.subteamId || e.subteamId === team.id).slice(0, 6).map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, type: e.type, allDay: e.allDay }))}
      weekMinutes={Object.fromEntries(weekMins)}
      finance={finance}
      currency={settings.currency}
    />
  );
}
