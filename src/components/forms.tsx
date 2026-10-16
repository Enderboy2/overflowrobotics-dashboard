"use client";

import * as React from "react";
import { format } from "date-fns";
import { useApp } from "./app-context";
import { Button, Dialog, Field, Select, Toggle, useAction } from "./ui";
import { deleteEvent, deleteProject, saveEvent, saveProject } from "@/lib/actions/misc";
import { EVENT_TYPES, PROJECT_STATUSES } from "@/lib/meta";
import { isLead, managedSubteams } from "@/lib/perm";
import type { EventType, ProjectStatus } from "@/db/schema";

export type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  subteamId: string | null;
  leadId: string | null;
  startDate: string | null;
  targetDate: string | null;
  budget: number | null;
};

export function ProjectDialog({ project, open, onOpenChange, onSaved }: { project?: ProjectData; open: boolean; onOpenChange: (v: boolean) => void; onSaved?: (id: string) => void }) {
  const { dir, me, activePeople } = useApp();
  const { run, pending } = useAction();
  const teams = me.isAdmin ? dir.teams : dir.teams.filter((t) => managedSubteams(me).includes(t.id));
  const [f, setF] = React.useState(() => ({
    name: project?.name ?? "",
    description: project?.description ?? "",
    status: project?.status ?? ("active" as ProjectStatus),
    subteamId: project?.subteamId ?? (me.isAdmin ? "" : (teams[0]?.id ?? "")),
    leadId: project?.leadId ?? me.id,
    startDate: project?.startDate ?? "",
    targetDate: project?.targetDate ?? "",
    budget: project?.budget?.toString() ?? "",
  }));
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={project ? "Edit project" : "New project"}
      wide
      footer={
        <>
          {project && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => confirm("Delete this project? Its tasks stay but lose the project link.") && run(() => deleteProject(project.id), { then: () => onOpenChange(false) })}
            >
              Delete
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={pending || !f.name.trim()}
            onClick={() =>
              run(
                () =>
                  saveProject(project?.id ?? null, {
                    ...f,
                    subteamId: f.subteamId || null,
                    leadId: f.leadId || null,
                    startDate: f.startDate || null,
                    targetDate: f.targetDate || null,
                    budget: f.budget ? Number(f.budget) : null,
                  }),
                {
                  success: "Project saved",
                  then: (r) => {
                    if (!r.ok) return;
                    onOpenChange(false);
                    onSaved?.(r.data);
                  },
                },
              )
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 pb-2 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} className="input" placeholder="e.g. ROV 2027 frame" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className="input" placeholder="Goal, scope, definition of done" />
        </Field>
        <Field label="Subteam">
          <Select value={f.subteamId} onChange={(e) => set({ subteamId: e.target.value })}>
            {me.isAdmin && <option value="">Cross-team</option>}
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={(e) => set({ status: e.target.value as ProjectStatus })}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lead">
          <Select value={f.leadId ?? ""} onChange={(e) => set({ leadId: e.target.value })}>
            <option value="">No lead</option>
            {activePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Budget">
          <input type="number" min={0} value={f.budget} onChange={(e) => set({ budget: e.target.value })} className="input" placeholder="Optional" />
        </Field>
        <Field label="Start">
          <input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} className="input" />
        </Field>
        <Field label="Target date">
          <input type="date" value={f.targetDate} onChange={(e) => set({ targetDate: e.target.value })} className="input" />
        </Field>
      </div>
    </Dialog>
  );
}

export type EventData = {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  subteamId: string | null;
  projectId: string | null;
  createdBy: string | null;
};

const local = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");

export function EventDialog({ event, defaultDate, open, onOpenChange }: { event?: EventData; defaultDate?: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { dir, me } = useApp();
  const { run, pending } = useAction();
  const canEdit = !event || me.isAdmin || (event.subteamId ? managedSubteams(me).includes(event.subteamId) : event.createdBy === me.id);
  const start = defaultDate ? `${defaultDate}T18:00` : format(new Date(), "yyyy-MM-dd'T'18:00");
  const [f, setF] = React.useState(() => ({
    title: event?.title ?? "",
    description: event?.description ?? "",
    type: event?.type ?? ("meeting" as EventType),
    startsAt: event ? local(event.startsAt) : start,
    endsAt: event?.endsAt ? local(event.endsAt) : "",
    allDay: event?.allDay ?? false,
    location: event?.location ?? "",
    subteamId: event?.subteamId ?? "",
    projectId: event?.projectId ?? "",
  }));
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={event ? (canEdit ? "Edit event" : event.title) : "New event"}
      wide
      footer={
        canEdit ? (
          <>
            {event && (
              <Button variant="danger" className="mr-auto" onClick={() => confirm("Delete this event?") && run(() => deleteEvent(event.id), { then: () => onOpenChange(false) })}>
                Delete
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={pending || !f.title.trim()}
              onClick={() =>
                run(
                  () =>
                    saveEvent(event?.id ?? null, {
                      ...f,
                      startsAt: new Date(f.allDay ? f.startsAt.slice(0, 10) + "T00:00" : f.startsAt).toISOString(),
                      endsAt: f.endsAt && !f.allDay ? new Date(f.endsAt).toISOString() : null,
                      subteamId: f.subteamId || null,
                      projectId: f.projectId || null,
                    }),
                  { success: "Event saved", then: (r) => r.ok && onOpenChange(false) },
                )
              }
            >
              Save
            </Button>
          </>
        ) : undefined
      }
    >
      <fieldset disabled={!canEdit} className="grid gap-3 pb-2 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <input autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} className="input" placeholder="e.g. Pool test #2" />
        </Field>
        <Field label="Type">
          <Select value={f.type} onChange={(e) => set({ type: e.target.value as EventType })}>
            {EVENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Location">
          <input value={f.location} onChange={(e) => set({ location: e.target.value })} className="input" placeholder="Lab, pool, online…" />
        </Field>
        <Field label={f.allDay ? "Date" : "Starts"}>
          <input type={f.allDay ? "date" : "datetime-local"} value={f.allDay ? f.startsAt.slice(0, 10) : f.startsAt} onChange={(e) => set({ startsAt: f.allDay ? e.target.value + "T00:00" : e.target.value })} className="input" />
        </Field>
        {!f.allDay ? (
          <Field label="Ends">
            <input type="datetime-local" value={f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className="input" />
          </Field>
        ) : (
          <div />
        )}
        <div className="sm:col-span-2">
          <Toggle checked={f.allDay} onChange={(v) => set({ allDay: v })} label="All day" />
        </div>
        <Field label="Subteam">
          <Select value={f.subteamId} onChange={(e) => set({ subteamId: e.target.value })}>
            {(me.isAdmin || isLead(me)) && <option value="">Whole team</option>}
            {dir.teams
              .filter((t) => me.isAdmin || managedSubteams(me).includes(t.id) || t.id === f.subteamId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Project">
          <Select value={f.projectId} onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">None</option>
            {dir.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className="input" placeholder="Agenda, what to bring…" />
        </Field>
      </fieldset>
    </Dialog>
  );
}
