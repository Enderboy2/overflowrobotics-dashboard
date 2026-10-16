"use client";

import * as React from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Button, Chip, Dot } from "@/components/ui";
import { CalendarView } from "@/components/workspace";
import { EventDialog, type EventData } from "@/components/forms";
import { EVENT_TYPES } from "@/lib/meta";
import { isLead } from "@/lib/perm";
import { cn, shortDate } from "@/lib/utils";
import type { TaskRow } from "@/lib/data";

export function CalendarClient({ tasks, events }: { tasks: TaskRow[]; events: (EventData & { createdAt: string })[] }) {
  const { me, dir } = useApp();
  const [dialog, setDialog] = React.useState<{ event?: EventData; date?: string } | null>(null);
  const [team, setTeam] = React.useState<string>("all");
  const [mine, setMine] = React.useState(false);
  const [showTasks, setShowTasks] = React.useState(true);
  const t = tasks.filter((x) => (team === "all" || x.subteamId === team) && (!mine || x.assigneeIds.includes(me.id)) && x.status !== "cancelled");
  const ev = events.filter((e) => team === "all" || !e.subteamId || e.subteamId === team);
  const upcoming = ev.filter((e) => new Date(e.startsAt) >= new Date(Date.now() - 864e5)).slice(0, 12);
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2 md:px-6">
          <Chip active={team === "all"} onClick={() => setTeam("all")}>
            All subteams
          </Chip>
          {dir.teams.map((x) => (
            <Chip key={x.id} active={team === x.id} onClick={() => setTeam(x.id)}>
              <Dot color={x.color} />
              {x.name}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          <Chip active={showTasks} onClick={() => setShowTasks((v) => !v)}>
            Task due dates
          </Chip>
          <Chip active={mine} onClick={() => setMine((v) => !v)}>
            Only my tasks
          </Chip>
          {isLead(me) && (
            <Button size="sm" variant="primary" className="ml-auto" onClick={() => setDialog({})}>
              <Plus />
              New event
            </Button>
          )}
        </div>
        <CalendarView
          rows={showTasks ? t : []}
          events={ev.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, color: EVENT_TYPES.find((x) => x.id === e.type)!.color, onClick: () => setDialog({ event: e }) }))}
          onDayClick={isLead(me) ? (d) => setDialog({ date: d }) : undefined}
        />
      </div>
      <aside className="border-t border-line px-4 py-4 lg:w-72 lg:border-l lg:border-t-0">
        <h2 className="mb-3 text-xs font-medium text-muted">Upcoming</h2>
        <ul className="space-y-1">
          {upcoming.map((e) => {
            const type = EVENT_TYPES.find((x) => x.id === e.type)!;
            return (
              <li key={e.id}>
                <button onClick={() => setDialog({ event: e })} className="w-full rounded-md px-2 py-2 text-left hover:bg-surface-2">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <span className="size-2 rounded-full" style={{ background: type.color }} />
                    <span className="truncate">{e.title}</span>
                  </div>
                  <div className={cn("pl-4 text-xs text-muted")}>
                    {shortDate(e.startsAt)}
                    {!e.allDay && ` · ${format(new Date(e.startsAt), "HH:mm")}`}
                    {e.location && ` · ${e.location}`}
                  </div>
                </button>
              </li>
            );
          })}
          {!upcoming.length && <li className="px-2 text-[13px] text-subtle">Nothing scheduled.</li>}
        </ul>
        {isLead(me) && <p className="mt-4 px-2 text-xs text-subtle">Tip: double-click a day to add an event on it.</p>}
      </aside>
      {dialog && <EventDialog open event={dialog.event} defaultDate={dialog.date} onOpenChange={(v) => !v && setDialog(null)} />}
    </div>
  );
}
