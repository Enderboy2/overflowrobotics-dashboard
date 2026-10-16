"use client";

import * as React from "react";
import { CalendarDays, Tag, FolderKanban, UserRound } from "lucide-react";
import { useApp } from "./app-context";
import { Avatar, AvatarStack, Chip, Dot, Picker, PriorityIcon, StatusIcon } from "./ui";
import { PRIORITIES, STATUSES, isClosed, priorityLabel, statusLabel } from "@/lib/meta";
import { cn, daysUntil, shortDate } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/db/schema";

export function StatusPicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: TaskStatus;
  onChange: (v: TaskStatus) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Picker
      disabled={disabled}
      options={STATUSES.map((s) => ({ value: s.id, label: s.label, icon: <StatusIcon status={s.id} /> }))}
      value={value}
      onChange={(v) => onChange(v as TaskStatus)}
      trigger={
        compact ? (
          <button type="button" aria-label={`Status: ${statusLabel(value)}`} title={statusLabel(value)} onClick={(e) => e.stopPropagation()} className="flex size-5 items-center justify-center rounded hover:bg-surface-3">
            <StatusIcon status={value} />
          </button>
        ) : (
          <Chip disabled={disabled}>
            <StatusIcon status={value} />
            {statusLabel(value)}
          </Chip>
        )
      }
    />
  );
}

export function PriorityPicker({ value, onChange, disabled, compact }: { value: number; onChange: (v: TaskPriority) => void; disabled?: boolean; compact?: boolean }) {
  return (
    <Picker
      disabled={disabled}
      options={PRIORITIES.map((p) => ({ value: p.id, label: p.label, icon: <PriorityIcon priority={p.id} /> }))}
      value={value as TaskPriority}
      onChange={(v) => onChange(v as TaskPriority)}
      trigger={
        compact ? (
          <button type="button" aria-label={`Priority: ${priorityLabel(value)}`} title={priorityLabel(value)} onClick={(e) => e.stopPropagation()} className="flex size-5 items-center justify-center rounded hover:bg-surface-3">
            <PriorityIcon priority={value} />
          </button>
        ) : (
          <Chip disabled={disabled}>
            <PriorityIcon priority={value} />
            {priorityLabel(value)}
          </Chip>
        )
      }
    />
  );
}

export function AssigneePicker({
  value,
  onChange,
  disabled,
  compact,
  subteamId,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
  subteamId?: string;
}) {
  const { activePeople, dir, person } = useApp();
  // members of the task's subteam first
  const inTeam = new Set(dir.memberships.filter((m) => m.subteamId === subteamId).map((m) => m.userId));
  const sorted = [...activePeople].sort((a, b) => Number(inTeam.has(b.id)) - Number(inTeam.has(a.id)));
  const people = value.map((id) => person(id)).filter(Boolean) as { id: string; name: string }[];
  return (
    <Picker
      multiple
      disabled={disabled}
      placeholder="Assign to…"
      options={sorted.map((p) => ({ value: p.id, label: p.name, icon: <Avatar id={p.id} name={p.name} size={16} />, hint: inTeam.has(p.id) ? undefined : (dir.teams.find((t) => dir.memberships.some((m) => m.userId === p.id && m.subteamId === t.id))?.code ?? "") }))}
      value={value}
      onChange={(v) => onChange(v as string[])}
      trigger={
        compact ? (
          <button type="button" aria-label="Assignees" onClick={(e) => e.stopPropagation()} className="flex h-6 min-w-6 items-center justify-center rounded hover:bg-surface-3">
            {people.length ? <AvatarStack people={people} /> : <UserRound className="size-4 text-subtle" />}
          </button>
        ) : (
          <Chip disabled={disabled}>
            {people.length ? (
              <>
                <AvatarStack people={people} size={16} />
                <span className="truncate">{people.length === 1 ? people[0].name : `${people.length} people`}</span>
              </>
            ) : (
              <>
                <UserRound />
                Unassigned
              </>
            )}
          </Chip>
        )
      }
    />
  );
}

export function TeamPicker({ value, onChange, disabled, only }: { value: string; onChange: (v: string) => void; disabled?: boolean; only?: string[] }) {
  const { dir, team } = useApp();
  const t = team(value);
  return (
    <Picker
      disabled={disabled}
      options={dir.teams.filter((x) => !only || only.includes(x.id)).map((x) => ({ value: x.id, label: x.name, icon: <Dot color={x.color} /> }))}
      value={value}
      onChange={(v) => onChange(v as string)}
      trigger={
        <Chip disabled={disabled}>
          {t ? <Dot color={t.color} /> : null}
          {t?.name ?? "Subteam"}
        </Chip>
      }
    />
  );
}

export function ProjectPicker({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const { dir, project } = useApp();
  const p = project(value);
  return (
    <Picker
      disabled={disabled}
      options={[{ value: "", label: "No project" }, ...dir.projects.filter((x) => x.status !== "done" || x.id === value).map((x) => ({ value: x.id, label: x.name }))]}
      value={value ?? ""}
      onChange={(v) => onChange((v as string) || null)}
      trigger={
        <Chip disabled={disabled} className="max-w-[220px]">
          <FolderKanban />
          <span className="truncate">{p?.name ?? "No project"}</span>
        </Chip>
      }
    />
  );
}

export function LabelPicker({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const { settings } = useApp();
  const all = [...new Set([...settings.labels, ...value])];
  return (
    <Picker
      multiple
      disabled={disabled}
      options={all.map((l) => ({ value: l, label: l }))}
      value={value}
      onChange={(v) => onChange(v as string[])}
      trigger={
        <Chip disabled={disabled}>
          <Tag />
          {value.length ? value.join(", ") : "Labels"}
        </Chip>
      }
    />
  );
}

export function DateChip({ value, onChange, disabled, placeholder = "Due date" }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean; placeholder?: string }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <span className="relative inline-flex">
      <Chip
        disabled={disabled}
        onClick={() => {
          try {
            ref.current?.showPicker();
          } catch {
            ref.current?.focus();
          }
        }}
      >
        <CalendarDays />
        {value ? shortDate(value) : placeholder}
      </Chip>
      <input
        ref={ref}
        type="date"
        tabIndex={-1}
        aria-label={placeholder}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </span>
  );
}

export function DueLabel({ date, status, className }: { date: string | null; status: TaskStatus; className?: string }) {
  if (!date) return null;
  const d = daysUntil(date);
  const closed = isClosed(status);
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 whitespace-nowrap text-xs",
        !closed && d < 0 ? "text-bad" : !closed && d <= 2 ? "text-warn" : "text-muted",
        className,
      )}
      title={date}
    >
      {shortDate(date)}
    </span>
  );
}

export function TeamTag({ id }: { id: string }) {
  const { team } = useApp();
  const t = team(id);
  if (!t) return null;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
      <Dot color={t.color} />
      {t.name}
    </span>
  );
}
