"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Link2,
  Ellipsis,
  Trash2,
  Paperclip,
  Play,
  Square,
  Plus,
  X,
  Receipt,
  SquareArrowOutUpRight,
  CornerLeftUp,
  Download,
  Ban,
  Clock,
} from "lucide-react";
import { useApp } from "./app-context";
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Picker,
  Progress,
  Sheet,
  StatusIcon,
  useAction,
  useToast,
} from "./ui";
import { AssigneePicker, DateChip, DueLabel, LabelPicker, PriorityPicker, ProjectPicker, StatusPicker, TeamPicker } from "./task-bits";
import { useCreateTask } from "./task-create";
import {
  addComment,
  addDependency,
  deleteComment,
  deleteFile,
  deleteTask,
  deleteTimeEntry,
  getTaskDetail,
  logTime,
  removeDependency,
  setAssignees,
  startTimer,
  stopTimer,
  updateTask,
  uploadTaskFile,
  type TaskDetail,
} from "@/lib/actions/tasks";
import { paletteData } from "@/lib/actions/misc";
import { REQUEST_STATUSES, priorityLabel, statusLabel } from "@/lib/meta";
import { ago, cn, dateTime, hours, longDate, money, todayISO } from "@/lib/utils";
import { managedSubteams } from "@/lib/perm";
import type { TaskStatus } from "@/db/schema";

/** Mounted once in the shell: opens a task in a side sheet whenever ?task=N is in the URL. */
export function TaskSheetHost() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const n = Number(sp.get("task"));
  const close = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete("task");
    const qs = q.toString();
    router.push(qs ? `${path}?${qs}` : path, { scroll: false });
  };
  if (!n || path.startsWith("/tasks/")) return null;
  return (
    <Sheet open onOpenChange={(v) => !v && close()} title="Task">
      <TaskDetailView number={n} onClose={close} inSheet />
    </Sheet>
  );
}

export function TaskDetailView({ number, onClose, inSheet }: { number: number; onClose?: () => void; inSheet?: boolean }) {
  const [data, setData] = React.useState<TaskDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const reload = React.useCallback(async () => {
    const r = await getTaskDetail(number);
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else setError(r.error);
  }, [number]);
  React.useEffect(() => {
    setData(null);
    reload();
  }, [reload]);

  if (error)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-[13px] text-muted">
        {error}
        {onClose && <Button onClick={onClose}>Close</Button>}
      </div>
    );
  if (!data)
    return (
      <div className="space-y-3 p-6">
        {[60, 90, 40].map((w) => (
          <div key={w} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  return <Detail data={data} reload={reload} onClose={onClose} inSheet={inSheet} />;
}

function Detail({ data, reload, onClose, inSheet }: { data: TaskDetail; reload: () => Promise<void>; onClose?: () => void; inSheet?: boolean }) {
  const { taskKey, team, person, me } = useApp();
  const { run } = useAction();
  const toast = useToast();
  const router = useRouter();
  const t = data.task;
  const key = taskKey(t);
  const tm = team(t.subteamId);

  const act = <R,>(fn: () => Promise<R>, success?: string) => run(fn, { success, then: () => void reload() });
  const patch = (p: Parameters<typeof updateTask>[1]) => act(() => updateTask(t.id, p));

  const minutes = data.time.reduce((a, e) => a + e.minutes, 0);
  const est = t.estimateHours ? t.estimateHours * 60 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
          <Link href={`/teams/${tm?.slug}`} className="flex items-center gap-1.5 text-muted hover:text-fg">
            <span className="size-2 rounded-[3px]" style={{ background: tm?.color }} />
            {tm?.name}
          </Link>
          <span className="text-subtle">/</span>
          <span className="font-mono text-xs font-medium text-muted">{key}</span>
        </div>
        <IconButton
          label="Copy link"
          onClick={() => {
            navigator.clipboard.writeText(`${location.origin}/tasks/${t.number}`);
            toast("Link copied");
          }}
        >
          <Link2 />
        </IconButton>
        {inSheet && (
          <IconButton label="Open as page" onClick={() => router.push(`/tasks/${t.number}`)}>
            <SquareArrowOutUpRight />
          </IconButton>
        )}
        {data.canEdit && (
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="More">
                <Ellipsis />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem icon={<Ban />} onSelect={() => patch({ status: "cancelled" })}>
                Cancel task
              </MenuItem>
              <MenuItem
                danger
                icon={<Trash2 />}
                onSelect={() => {
                  if (confirm(`Delete ${key}? This also removes its comments and time entries.`))
                    run(() => deleteTask(t.id), { success: "Task deleted", then: () => (onClose ? onClose() : router.push("/tasks")) });
                }}
              >
                Delete task
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
        {onClose && (
          <IconButton label="Close" onClick={onClose}>
            <X />
          </IconButton>
        )}
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_260px] lg:overflow-hidden">
        {/* Main column */}
        <div className="min-w-0 px-5 py-5 lg:overflow-y-auto lg:px-7">
          {data.parent && (
            <Link href={`?task=${data.parent.number}`} scroll={false} className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
              <CornerLeftUp className="size-3.5" />
              <span className="font-mono">{taskKey(data.parent)}</span> {data.parent.title}
            </Link>
          )}
          <EditableTitle value={t.title} disabled={!data.canEdit} onSave={(title) => patch({ title })} />
          <Description value={t.description} disabled={!data.canEdit} onSave={(description) => patch({ description })} />

          <Subtasks data={data} reload={reload} />
          <Dependencies data={data} reload={reload} />
          <Files data={data} reload={reload} />
          <Finance data={data} />
          <Timeline data={data} reload={reload} />
        </div>

        {/* Properties */}
        <aside className="border-t border-line bg-bg/50 px-5 py-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <Props>
            <Prop label="Status">
              <StatusPicker value={t.status} disabled={!data.canWork} onChange={(status) => patch({ status })} />
            </Prop>
            <Prop label="Priority">
              <PriorityPicker value={t.priority} disabled={!data.canEdit} onChange={(priority) => patch({ priority })} />
            </Prop>
            <Prop label="Assignees">
              <AssigneePicker value={data.assigneeIds} subteamId={t.subteamId} disabled={!data.canEdit} onChange={(ids) => act(() => setAssignees(t.id, ids))} />
            </Prop>
            <Prop label="Subteam">
              <TeamPicker value={t.subteamId} disabled={!data.canEdit} only={me.isAdmin ? undefined : managedSubteams(me)} onChange={(subteamId) => patch({ subteamId })} />
            </Prop>
            <Prop label="Project">
              <ProjectPicker value={t.projectId} disabled={!data.canEdit} onChange={(projectId) => patch({ projectId })} />
            </Prop>
            <Prop label="Start">
              <DateChip value={t.startDate} placeholder="Set start" disabled={!data.canEdit} onChange={(startDate) => patch({ startDate })} />
            </Prop>
            <Prop label="Due">
              <DateChip value={t.dueDate} placeholder="Set due date" disabled={!data.canEdit} onChange={(dueDate) => patch({ dueDate })} />
            </Prop>
            <Prop label="Labels">
              <LabelPicker value={t.labels} disabled={!data.canEdit} onChange={(labels) => patch({ labels })} />
            </Prop>
            <Prop label="Estimate">
              <EstimateInput value={t.estimateHours} disabled={!data.canEdit} onSave={(estimateHours) => patch({ estimateHours })} />
            </Prop>
          </Props>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted">Time</h3>
              <span className="tabular text-xs text-muted">
                {hours(minutes)}
                {est ? ` / ${hours(est)}` : ""}
              </span>
            </div>
            {est > 0 && <Progress value={minutes / est} color={minutes > est ? "var(--bad)" : "var(--fg)"} className="mb-3" />}
            {data.canWork && <TimeControls data={data} reload={reload} />}
            <TimeList data={data} reload={reload} />
          </div>

          <div className="mt-6 space-y-1 text-xs text-subtle">
            <div>
              Created by {person(t.createdBy)?.name ?? "—"} · {longDate(t.createdAt)}
            </div>
            <div>Updated {ago(t.updatedAt)}</div>
            {t.completedAt && <div>Completed {longDate(t.completedAt)}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Props({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[76px_1fr] items-center gap-x-2 gap-y-1.5">{children}</div>;
}
function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="text-xs text-muted">{label}</span>
      <div className="min-w-0 [&>*]:max-w-full">{children}</div>
    </>
  );
}

function EditableTitle({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled: boolean }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  return (
    <textarea
      value={v}
      readOnly={disabled}
      rows={1}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value && onSave(v.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className="field-sizing-content w-full resize-none bg-transparent text-xl font-semibold leading-snug tracking-tight outline-none"
      style={{ fieldSizing: "content" } as React.CSSProperties}
    />
  );
}

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer" className="text-info underline decoration-info/30 underline-offset-2 hover:decoration-info">
        {p.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
      </a>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

export function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed">
      {text.split("\n").map((line, i) => {
        const m = line.match(/^\s*[-*]\s+(\[( |x)\]\s+)?(.*)$/);
        if (m)
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="mt-[9px] size-1 shrink-0 rounded-full bg-muted" />
              <span className={cn(m[2] === "x" && "text-muted line-through")}>{linkify(m[3])}</span>
            </div>
          );
        if (/^#{1,3}\s/.test(line)) return <div key={i} className="pt-2 font-semibold">{line.replace(/^#+\s/, "")}</div>;
        return line.trim() ? <p key={i}>{linkify(line)}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

function Description({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled: boolean }) {
  const [editing, setEditing] = React.useState(false);
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  if (editing)
    return (
      <div className="mt-2">
        <textarea
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              setEditing(false);
              if (v !== value) onSave(v);
            }
            if (e.key === "Escape") {
              e.stopPropagation();
              setV(value);
              setEditing(false);
            }
          }}
          rows={Math.max(5, v.split("\n").length + 1)}
          placeholder="Use - for bullet points. Links become clickable."
          className="input leading-relaxed"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => (setV(value), setEditing(false))}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={() => (setEditing(false), v !== value && onSave(v))}>
            Save
          </Button>
        </div>
      </div>
    );
  return (
    <div
      onClick={() => !disabled && setEditing(true)}
      className={cn("-mx-2 mt-1 min-h-[40px] rounded-md px-2 py-1.5", !disabled && "cursor-text hover:bg-surface-2/60")}
    >
      {value ? <RichText text={value} /> : <span className="text-[13.5px] text-subtle">{disabled ? "No description" : "Add a description…"}</span>}
    </div>
  );
}

function EstimateInput({ value, onSave, disabled }: { value: number | null; onSave: (v: number | null) => void; disabled: boolean }) {
  const [v, setV] = React.useState(value?.toString() ?? "");
  React.useEffect(() => setV(value?.toString() ?? ""), [value]);
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[12.5px]">
      <input
        type="number"
        min={0}
        step={0.5}
        disabled={disabled}
        value={v}
        placeholder="—"
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = v === "" ? null : Number(v);
          if (n !== value) onSave(n);
        }}
        className="w-12 bg-transparent outline-none disabled:text-muted"
      />
      <span className="text-subtle">hours</span>
    </span>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-8 flex items-center justify-between">
      <h3 className="text-xs font-medium text-muted">{children}</h3>
      {action}
    </div>
  );
}

function MiniTask({ t, right }: { t: { number: number; title: string; status: TaskStatus; subteamId: string }; right?: React.ReactNode }) {
  const { taskKey } = useApp();
  return (
    <div className="group flex h-8 items-center gap-2 rounded-md px-2 hover:bg-surface-2">
      <StatusIcon status={t.status} />
      <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-subtle">{taskKey(t)}</span>
      <Link href={`?task=${t.number}`} scroll={false} className={cn("min-w-0 flex-1 truncate text-[13px]", t.status === "done" && "text-muted line-through")}>
        {t.title}
      </Link>
      {right}
    </div>
  );
}

function Subtasks({ data, reload }: { data: TaskDetail; reload: () => Promise<void> }) {
  const create = useCreateTask();
  const { taskKey } = useApp();
  const t = data.task;
  const done = data.subtasks.filter((x) => x.status === "done").length;
  if (!data.subtasks.length && !data.canWork) return null;
  return (
    <>
      <SectionTitle
        action={
          data.canWork && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => create({ parentId: t.id, parentLabel: taskKey(t), subteamId: t.subteamId, projectId: t.projectId, onCreated: () => void reload() })}
            >
              <Plus />
              Add
            </Button>
          )
        }
      >
        Subtasks {data.subtasks.length > 0 && <span className="ml-1 text-subtle">{done}/{data.subtasks.length}</span>}
      </SectionTitle>
      <div className="-mx-2">
        {data.subtasks.map((s) => (
          <MiniTask key={s.id} t={s} right={<DueLabel date={s.dueDate} status={s.status} />} />
        ))}
        {!data.subtasks.length && <p className="px-2 text-[13px] text-subtle">Break this down into smaller pieces.</p>}
      </div>
    </>
  );
}

function Dependencies({ data, reload }: { data: TaskDetail; reload: () => Promise<void> }) {
  const { run } = useAction();
  const { taskKey } = useApp();
  const [opts, setOpts] = React.useState<{ id: string; number: number; title: string; subteamId: string }[]>([]);
  const t = data.task;
  if (!data.blockedBy.length && !data.blocking.length && !data.canEdit) return null;
  return (
    <>
      <SectionTitle
        action={
          data.canEdit && (
            <Picker
              options={opts.filter((o) => o.id !== t.id && !data.blockedBy.some((b) => b.id === o.id)).map((o) => ({ value: o.id, label: `${taskKey(o)} ${o.title}` }))}
              value={null}
              placeholder="Search tasks…"
              align="end"
              onChange={(v) => run(() => addDependency(t.id, v as string), { then: () => void reload() })}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!opts.length) {
                      const r = await paletteData();
                      if (r.ok) setOpts(r.data);
                    }
                  }}
                >
                  <Plus />
                  Blocked by
                </Button>
              }
            />
          )
        }
      >
        Dependencies
      </SectionTitle>
      <div className="-mx-2">
        {data.blockedBy.map((b) => (
          <MiniTask
            key={b.id}
            t={b}
            right={
              <>
                <Badge tone={b.status === "done" ? "green" : "red"}>{b.status === "done" ? "Resolved" : "Blocking this"}</Badge>
                {data.canEdit && (
                  <IconButton label="Remove" className="size-6 opacity-0 group-hover:opacity-100" onClick={() => run(() => removeDependency(t.id, b.id), { then: () => void reload() })}>
                    <X />
                  </IconButton>
                )}
              </>
            }
          />
        ))}
        {data.blocking.map((b) => (
          <MiniTask key={b.id} t={b} right={<Badge tone="amber">Waiting on this</Badge>} />
        ))}
        {!data.blockedBy.length && !data.blocking.length && <p className="px-2 text-[13px] text-subtle">No dependencies.</p>}
      </div>
    </>
  );
}

function Files({ data, reload }: { data: TaskDetail; reload: () => Promise<void> }) {
  const { run, pending } = useAction();
  const input = React.useRef<HTMLInputElement>(null);
  if (!data.files.length && !data.canWork) return null;
  return (
    <>
      <SectionTitle
        action={
          data.canWork && (
            <>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => input.current?.click()}>
                <Paperclip />
                Attach
              </Button>
              <input
                ref={input}
                type="file"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.set("taskId", data.task.id);
                  fd.set("file", file);
                  run(() => uploadTaskFile(fd), { success: "File attached", then: () => void reload() });
                  e.target.value = "";
                }}
              />
            </>
          )
        }
      >
        Attachments
      </SectionTitle>
      <div className="-mx-2">
        {data.files.map((f) => (
          <div key={f.id} className="group flex h-8 items-center gap-2 rounded-md px-2 hover:bg-surface-2">
            <Paperclip className="size-3.5 text-subtle" />
            <a href={`/api/files/${f.id}`} target="_blank" className="min-w-0 flex-1 truncate text-[13px] hover:underline">
              {f.name}
            </a>
            <span className="text-xs text-subtle">{(f.size / 1024).toFixed(0)} KB</span>
            <a href={`/api/files/${f.id}?download=1`} aria-label="Download" className="text-subtle hover:text-fg">
              <Download className="size-3.5" />
            </a>
            {data.canEdit && (
              <IconButton label="Remove file" className="size-6 opacity-0 group-hover:opacity-100" onClick={() => confirm(`Remove ${f.name}?`) && run(() => deleteFile(f.id), { then: () => void reload() })}>
                <X />
              </IconButton>
            )}
          </div>
        ))}
        {!data.files.length && <p className="px-2 text-[13px] text-subtle">CAD exports, datasheets, photos — up to 5 MB each.</p>}
      </div>
    </>
  );
}

function Finance({ data }: { data: TaskDetail }) {
  const { settings } = useApp();
  const t = data.task;
  return (
    <>
      <SectionTitle
        action={
          <Link href={`/finance/requests?new=1&task=${t.id}&team=${t.subteamId}${t.projectId ? `&project=${t.projectId}` : ""}`}>
            <Button size="sm" variant="ghost">
              <Receipt />
              Request purchase
            </Button>
          </Link>
        }
      >
        Purchases & spending
      </SectionTitle>
      <div className="-mx-2">
        {data.requests.map((r) => {
          const st = REQUEST_STATUSES.find((x) => x.id === r.status)!;
          return (
            <Link key={r.id} href={`/finance/requests?r=${r.number}`} className="flex h-8 items-center gap-2 rounded-md px-2 hover:bg-surface-2">
              <span className="font-mono text-[11px] text-subtle">PR-{r.number}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{r.title}</span>
              <Badge tone={st.tone}>{st.label}</Badge>
              <span className="tabular text-xs text-muted">{money(r.total, settings.currency)}</span>
            </Link>
          );
        })}
        {data.transactions.map((x) => (
          <div key={x.id} className="flex h-8 items-center gap-2 rounded-md px-2">
            <Receipt className="size-3.5 text-subtle" />
            <span className="min-w-0 flex-1 truncate text-[13px]">{x.description}</span>
            <span className="text-xs text-subtle">{longDate(x.date)}</span>
            <span className="tabular text-xs">{money(x.type === "expense" ? -x.amount : x.amount, settings.currency)}</span>
          </div>
        ))}
        {!data.requests.length && !data.transactions.length && <p className="px-2 text-[13px] text-subtle">Nothing purchased for this task yet.</p>}
      </div>
    </>
  );
}

function TimeControls({ data, reload }: { data: TaskDetail; reload: () => Promise<void> }) {
  const { run, pending } = useAction();
  const [open, setOpen] = React.useState(false);
  const [h, setH] = React.useState("1");
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState("");
  const running = !!data.timerStartedAt;
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="flex-1"
          disabled={pending}
          onClick={() => run((): Promise<unknown> => (running ? stopTimer() : startTimer(data.task.id)), { success: running ? "Time logged" : "Timer started", then: () => void reload() })}
        >
          {running ? <Square className="fill-current text-accent" /> : <Play />}
          {running ? `Stop · started ${dateTime(data.timerStartedAt!).split(", ")[1]}` : "Start timer"}
        </Button>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <Clock />
          Log
        </Button>
      </div>
      {open && (
        <form
          className="space-y-2 rounded-md border border-line bg-surface p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const m = Math.round(Number(h) * 60);
            if (!m) return;
            run(() => logTime(data.task.id, m, date, note), {
              success: "Time logged",
              then: () => {
                setOpen(false);
                setNote("");
                reload();
              },
            });
          }}
        >
          <div className="flex gap-1.5">
            <input type="number" min={0.25} step={0.25} value={h} onChange={(e) => setH(e.target.value)} className="input w-16" aria-label="Hours" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" aria-label="Date" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you work on?" className="input" />
          <Button size="sm" variant="primary" className="w-full" disabled={pending}>
            Log {h || 0}h
          </Button>
        </form>
      )}
    </div>
  );
}

function TimeList({ data, reload }: { data: TaskDetail; reload: () => Promise<void> }) {
  const { person, me } = useApp();
  const { run } = useAction();
  const [all, setAll] = React.useState(false);
  const list = all ? data.time : data.time.slice(0, 4);
  if (!data.time.length) return null;
  return (
    <div className="mt-3 space-y-0.5">
      {list.map((e) => {
        const p = person(e.userId);
        return (
          <div key={e.id} className="group flex items-center gap-2 py-1 text-xs">
            {p && <Avatar id={p.id} name={p.name} size={16} />}
            <span className="min-w-0 flex-1 truncate text-muted" title={e.note ?? ""}>
              {p?.name.split(" ")[0]} · {longDate(e.date).replace(/, \d{4}$/, "")}
              {e.note && e.note !== "Timer" ? ` · ${e.note}` : ""}
            </span>
            <span className="tabular">{hours(e.minutes)}</span>
            {(e.userId === me.id || data.canEdit) && (
              <button aria-label="Delete entry" className="text-subtle opacity-0 hover:text-bad group-hover:opacity-100" onClick={() => run(() => deleteTimeEntry(e.id), { then: () => void reload() })}>
                <X className="size-3" />
              </button>
            )}
          </div>
        );
      })}
      {data.time.length > 4 && (
        <button className="text-xs text-muted hover:text-fg" onClick={() => setAll((v) => !v)}>
          {all ? "Show less" : `Show all ${data.time.length}`}
        </button>
      )}
    </div>
  );
}

function describe(a: TaskDetail["activity"][number], ctx: ReturnType<typeof useApp>): React.ReactNode {
  const d = (a.detail ?? {}) as Record<string, unknown>;
  const name = (id: unknown) => ctx.person(id as string)?.name ?? "someone";
  switch (a.action) {
    case "created":
      return "created the task";
    case "status":
      return (
        <>
          changed status from <b className="font-medium text-fg">{statusLabel(d.from as TaskStatus)}</b> to <b className="font-medium text-fg">{statusLabel(d.to as TaskStatus)}</b>
        </>
      );
    case "priority":
      return `set priority to ${priorityLabel(Number(d.to))}`;
    case "dueDate":
      return d.to ? `set the due date to ${longDate(d.to as string)}` : "removed the due date";
    case "startDate":
      return d.to ? `set the start date to ${longDate(d.to as string)}` : "removed the start date";
    case "title":
      return `renamed the task`;
    case "description":
      return "updated the description";
    case "estimateHours":
      return d.to ? `estimated ${d.to}h` : "removed the estimate";
    case "subteamId":
      return `moved it to ${ctx.team(d.to as string)?.name}`;
    case "projectId":
      return d.to ? `added it to ${ctx.project(d.to as string)?.name ?? "a project"}` : "removed it from its project";
    case "assignees": {
      const add = (d.added as string[]) ?? [];
      const rem = (d.removed as string[]) ?? [];
      return [add.length && `assigned ${add.map(name).join(", ")}`, rem.length && `unassigned ${rem.map(name).join(", ")}`].filter(Boolean).join(" and ");
    }
    case "file":
      return `attached ${d.name}`;
    case "dependency":
      return "added a dependency";
    case "bulk":
      return "updated this in a bulk edit";
    default:
      return a.action;
  }
}

function Timeline({ data, reload }: { data: TaskDetail; reload: () => Promise<void> }) {
  const ctx = useApp();
  const { run, pending } = useAction();
  const [body, setBody] = React.useState("");
  const items = [
    ...data.comments.map((c) => ({ kind: "comment" as const, at: c.createdAt, c })),
    ...data.activity.map((a) => ({ kind: "activity" as const, at: a.createdAt, a })),
  ].sort((x, y) => x.at.localeCompare(y.at));
  const submit = () => {
    if (!body.trim()) return;
    run(() => addComment(data.task.id, body), {
      then: () => {
        setBody("");
        reload();
      },
    });
  };
  return (
    <>
      <SectionTitle>Activity</SectionTitle>
      <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-line">
        {items.map((it) =>
          it.kind === "comment" ? (
            <li key={it.c.id} className="relative flex gap-3">
              <Avatar id={it.c.userId ?? "x"} name={ctx.person(it.c.userId)?.name ?? "?"} size={20} />
              <div className="group min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2">
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className="font-medium">{ctx.person(it.c.userId)?.name ?? "Former member"}</span>
                  <span className="text-subtle" title={dateTime(it.c.createdAt)}>
                    {ago(it.c.createdAt)}
                  </span>
                  {(it.c.userId === ctx.me.id || ctx.me.isAdmin) && (
                    <button className="ml-auto text-subtle opacity-0 hover:text-bad group-hover:opacity-100" onClick={() => run(() => deleteComment(it.c.id), { then: () => void reload() })}>
                      Delete
                    </button>
                  )}
                </div>
                <RichText text={it.c.body} />
              </div>
            </li>
          ) : (
            <li key={it.a.id} className="relative flex items-center gap-3 text-xs text-muted">
              <span className="flex size-5 items-center justify-center">
                <span className="size-1.5 rounded-full bg-line-strong ring-4 ring-surface" />
              </span>
              <span>
                <span className="font-medium text-fg">{ctx.person(it.a.actorId)?.name ?? "Someone"}</span> {describe(it.a, ctx)}
                <span className="text-subtle"> · {ago(it.a.createdAt)}</span>
              </span>
            </li>
          ),
        )}
      </ol>
      <div className="mt-4 rounded-lg border border-line bg-surface focus-within:border-line-strong">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={2}
          placeholder="Leave a comment. Use @Name to notify someone."
          className="block w-full resize-none bg-transparent px-3 py-2 text-[13.5px] outline-none placeholder:text-subtle"
        />
        <div className="flex justify-end px-2 pb-2">
          <Button size="sm" variant="primary" disabled={pending || !body.trim()} onClick={submit}>
            Comment
          </Button>
        </div>
      </div>
    </>
  );
}
