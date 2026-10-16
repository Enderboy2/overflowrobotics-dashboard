import Link from "next/link";
import { format, startOfWeek, addDays } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { getDirectory, getTaskRows, minutesByUser } from "@/lib/data";
import { getActivity, getEvents, getRequests, getTransactions } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { isFinance, isLead, managedSubteams, manages } from "@/lib/perm";
import { isClosed, EVENT_TYPES } from "@/lib/meta";
import { cn, daysUntil, hours, money, shortDate, todayISO } from "@/lib/utils";
import { Card, PageHeader, Progress, Stat } from "@/components/ui";
import { ActivityFeed, TaskMiniList } from "@/components/lists";

export const metadata = { title: "Home" };

export default async function Home() {
  const me = await requireMe();
  const [tasks, dir, events, activity, settings] = await Promise.all([getTaskRows(), getDirectory(), getEvents(addDays(new Date(), -1).toISOString()), getActivity({ limit: 14 }), getSettings()]);
  const today = todayISO();
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 6 }), "yyyy-MM-dd");
  const mins = await minutesByUser([me.id], weekStart);

  const mine = tasks.filter((t) => t.assigneeIds.includes(me.id) && !isClosed(t.status));
  const overdue = mine.filter((t) => t.dueDate && t.dueDate < today);
  const dueWeek = mine.filter((t) => t.dueDate && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7);
  const focus = [...mine].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || (a.priority || 9) - (b.priority || 9)).slice(0, 8);
  const upcoming = events.filter((e) => daysUntil(e.startsAt.slice(0, 10)) <= 21).slice(0, 6);
  const deadlines = tasks
    .filter((t) => !isClosed(t.status) && t.dueDate && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7 && (me.isAdmin || managedSubteams(me).includes(t.subteamId)))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  const lead = isLead(me);
  const teams = me.isAdmin ? dir.teams : dir.teams.filter((t) => manages(me, t.id));
  const requests = lead ? await getRequests() : [];
  const needsMe = requests.filter((r) => (r.status === "pending" && manages(me, r.subteamId)) || (r.status === "head_approved" && isFinance(me)));
  const fin = isFinance(me) ? await getTransactions() : [];
  const balance = fin.reduce((a, t) => a + (t.type === "income" ? t.amount : -t.amount), 0);
  const monthStart = today.slice(0, 8) + "01";
  const spentMonth = fin.filter((t) => t.type === "expense" && t.date >= monthStart).reduce((a, t) => a + t.amount, 0);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader title="Home" />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {greet}, {me.name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">{format(new Date(), "EEEE, MMMM d")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="My open tasks" value={mine.length} sub={`${mine.filter((t) => t.status === "in_progress").length} in progress`} />
          <Stat label="Due in 7 days" value={dueWeek.length} tone={dueWeek.length ? "warn" : undefined} />
          <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "bad" : undefined} />
          <Stat label="Logged this week" value={hours(mins.get(me.id) ?? 0)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <Card
              title="My focus"
              action={
                <Link href="/my-tasks" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
                  All my tasks <ArrowUpRight className="size-3" />
                </Link>
              }
            >
              <TaskMiniList rows={focus} empty="You're all caught up." showTeam />
            </Card>

            {lead && teams.length > 0 && (
              <Card title={me.isAdmin ? "Team pulse" : "Your subteam"}>
                <div className="divide-y divide-line">
                  {teams.map((t) => {
                    const tt = tasks.filter((x) => x.subteamId === t.id && x.status !== "cancelled");
                    const done = tt.filter((x) => x.status === "done").length;
                    const od = tt.filter((x) => !isClosed(x.status) && x.dueDate && x.dueDate < today).length;
                    const blocked = tt.filter((x) => x.status === "blocked" || x.openBlockers > 0).length;
                    const inReview = tt.filter((x) => x.status === "review").length;
                    return (
                      <Link key={t.id} href={`/teams/${t.slug}`} className="grid grid-cols-[140px_1fr] items-center gap-4 px-4 py-3 hover:bg-surface-2/60 sm:grid-cols-[160px_1fr_auto]">
                        <span className="flex items-center gap-2 text-[13px] font-medium">
                          <span className="size-2.5 rounded-[3px]" style={{ background: t.color }} />
                          {t.name}
                        </span>
                        <span className="flex items-center gap-3">
                          <Progress value={tt.length ? done / tt.length : 0} color={t.color} />
                          <span className="tabular w-16 shrink-0 text-xs text-muted">
                            {done}/{tt.length} done
                          </span>
                        </span>
                        <span className="col-span-2 flex gap-3 text-xs sm:col-span-1">
                          <span className={cn(od ? "text-bad" : "text-subtle")}>{od} overdue</span>
                          <span className={cn(blocked ? "text-warn" : "text-subtle")}>{blocked} blocked</span>
                          <span className="text-subtle">{inReview} in review</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            )}

            {lead && deadlines.length > 0 && (
              <Card title="Team deadlines this week">
                <TaskMiniList rows={deadlines.slice(0, 10)} showTeam />
              </Card>
            )}
          </div>

          <div className="min-w-0 space-y-6">
            {needsMe.length > 0 && (
              <Card
                title="Needs your approval"
                action={
                  <Link href="/finance/requests" className="text-xs text-muted hover:text-fg">
                    Review
                  </Link>
                }
              >
                <div className="divide-y divide-line">
                  {needsMe.slice(0, 5).map((r) => (
                    <Link key={r.id} href={`/finance/requests?r=${r.number}`} className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-surface-2/60">
                      <span className="font-mono text-[11px] text-subtle">PR-{r.number}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      {r.urgent && <span className="text-[11px] font-medium text-bad">Urgent</span>}
                      <span className="tabular text-xs text-muted">{money(r.total, settings.currency, { compact: true })}</span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {isFinance(me) && (
              <Card
                title="Finance"
                action={
                  <Link href="/finance" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
                    Open <ArrowUpRight className="size-3" />
                  </Link>
                }
              >
                <div className="grid grid-cols-2 divide-x divide-line">
                  <div className="px-4 py-3">
                    <div className="text-xs text-muted">Balance</div>
                    <div className={cn("tabular mt-0.5 text-lg font-semibold", balance < 0 && "text-bad")}>{money(balance, settings.currency, { compact: true })}</div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-xs text-muted">Spent this month</div>
                    <div className="tabular mt-0.5 text-lg font-semibold">{money(spentMonth, settings.currency, { compact: true })}</div>
                  </div>
                </div>
              </Card>
            )}

            <Card
              title="Coming up"
              action={
                <Link href="/calendar" className="text-xs text-muted hover:text-fg">
                  Calendar
                </Link>
              }
            >
              {upcoming.length ? (
                <ul className="divide-y divide-line">
                  {upcoming.map((e) => {
                    const type = EVENT_TYPES.find((x) => x.id === e.type)!;
                    const d = new Date(e.startsAt);
                    return (
                      <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex w-10 shrink-0 flex-col items-center rounded-md border border-line py-1">
                          <span className="text-[10px] uppercase text-muted">{format(d, "MMM")}</span>
                          <span className="text-[15px] font-semibold leading-none">{format(d, "d")}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">{e.title}</div>
                          <div className="truncate text-xs text-muted">
                            <span style={{ color: type.color }}>{type.label}</span>
                            {!e.allDay && ` · ${format(d, "HH:mm")}`}
                            {e.location && ` · ${e.location}`}
                            {` · ${shortDate(e.startsAt)}`}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-4 py-8 text-center text-[13px] text-subtle">Nothing scheduled in the next 3 weeks.</div>
              )}
            </Card>

            <Card title="Recent activity">
              <ActivityFeed items={activity} />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
