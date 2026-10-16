"use client";

import * as React from "react";
import {
  List,
  SquareKanban,
  CalendarDays,
  ChartGantt,
  ListFilter,
  SlidersHorizontal,
  Plus,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  Download,
  Trash2,
  Link2,
  Layers,
  Check,
} from "lucide-react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useApp } from "./app-context";
import { useOpenTask } from "./shell";
import { useCreateTask } from "./task-create";
import {
  AvatarStack,
  Avatar,
  Badge,
  Button,
  Chip,
  Dialog,
  Dot,
  Empty,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Picker,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PriorityIcon,
  Select,
  StatusIcon,
  Toggle,
  useAction,
  useToast,
} from "./ui";
import { AssigneePicker, DueLabel, PriorityPicker, StatusPicker } from "./task-bits";
import { bulkUpdate, moveTask, setAssignees, updateTask } from "@/lib/actions/tasks";
import { deleteView, saveView } from "@/lib/actions/misc";
import { PRIORITIES, STATUSES, isClosed, priorityLabel, statusLabel } from "@/lib/meta";
import { canEditTask, isLead } from "@/lib/perm";
import { cn, csv, daysUntil, hours } from "@/lib/utils";
import type { TaskRow } from "@/lib/data";
import type { TaskPriority, TaskStatus, ViewConfig } from "@/db/schema";

/* ───────── View state ───────── */

export type Layout = "list" | "board" | "calendar" | "timeline";
type GroupBy = "status" | "priority" | "assignee" | "subteam" | "project" | "due" | "none";
type SortBy = "manual" | "priority" | "due" | "updated" | "created" | "title";

type Filters = {
  status: string[];
  priority: string[];
  assignee: string[]; // user ids, "me", "none"
  subteam: string[];
  project: string[]; // ids or "none"
  label: string[];
  due: string[]; // overdue, today, week, month, none
  q: string;
  showClosed: boolean;
  showSubtasks: boolean;
};

export type View = { layout: Layout; groupBy: GroupBy; sort: SortBy; filters: Filters };

const emptyFilters: Filters = { status: [], priority: [], assignee: [], subteam: [], project: [], label: [], due: [], q: "", showClosed: true, showSubtasks: true };

const LIST_KEYS = ["status", "priority", "assignee", "subteam", "project", "label", "due"] as const;

function viewFromParams(sp: URLSearchParams, base: View): View {
  const v: View = { ...base, filters: { ...base.filters } };
  if (sp.get("layout")) v.layout = sp.get("layout") as Layout;
  if (sp.get("group")) v.groupBy = sp.get("group") as GroupBy;
  if (sp.get("sort")) v.sort = sp.get("sort") as SortBy;
  for (const k of LIST_KEYS) if (sp.get(k)) v.filters[k] = sp.get(k)!.split(",");
  if (sp.get("q")) v.filters.q = sp.get("q")!;
  if (sp.get("closed")) v.filters.showClosed = sp.get("closed") === "1";
  if (sp.get("subtasks")) v.filters.showSubtasks = sp.get("subtasks") === "1";
  return v;
}

function viewToParams(v: View, base: View) {
  const q = new URLSearchParams();
  if (v.layout !== base.layout) q.set("layout", v.layout);
  if (v.groupBy !== base.groupBy) q.set("group", v.groupBy);
  if (v.sort !== base.sort) q.set("sort", v.sort);
  for (const k of LIST_KEYS) if (v.filters[k].length) q.set(k, v.filters[k].join(","));
  if (v.filters.q) q.set("q", v.filters.q);
  if (v.filters.showClosed !== base.filters.showClosed) q.set("closed", v.filters.showClosed ? "1" : "0");
  if (v.filters.showSubtasks !== base.filters.showSubtasks) q.set("subtasks", v.filters.showSubtasks ? "1" : "0");
  return q;
}

function dueBucket(t: TaskRow): string {
  if (!t.dueDate) return "none";
  const d = daysUntil(t.dueDate);
  if (d < 0 && !isClosed(t.status)) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "week";
  if (d <= 31) return "month";
  return "later";
}
const DUE_GROUPS = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "Next 7 days" },
  { id: "month", label: "Next 30 days" },
  { id: "later", label: "Later" },
  { id: "none", label: "No due date" },
];

function applyFilters(rows: TaskRow[], f: Filters, meId: string) {
  const q = f.q.trim().toLowerCase();
  return rows.filter((t) => {
    if (!f.showClosed && isClosed(t.status)) return false;
    if (!f.showSubtasks && t.parentId) return false;
    if (f.status.length && !f.status.includes(t.status)) return false;
    if (f.priority.length && !f.priority.includes(String(t.priority))) return false;
    if (f.subteam.length && !f.subteam.includes(t.subteamId)) return false;
    if (f.project.length && !f.project.includes(t.projectId ?? "none")) return false;
    if (f.label.length && !t.labels.some((l) => f.label.includes(l))) return false;
    if (f.assignee.length) {
      const ids = f.assignee.map((a) => (a === "me" ? meId : a));
      const ok = ids.some((a) => (a === "none" ? t.assigneeIds.length === 0 : t.assigneeIds.includes(a)));
      if (!ok) return false;
    }
    if (f.due.length) {
      const b = dueBucket(t);
      const match = f.due.some((d) => d === b || (d === "week" && (b === "today" || b === "overdue")) || (d === "month" && ["today", "week", "overdue"].includes(b)));
      if (!match) return false;
    }
    if (q && !t.title.toLowerCase().includes(q) && !String(t.number).includes(q.replace(/^[a-z]+-/, ""))) return false;
    return true;
  });
}

const STATUS_ORDER = Object.fromEntries(STATUSES.map((s, i) => [s.id, i]));
const PRI_ORDER = (p: number) => (p === 0 ? 9 : p);

function sortRows(rows: TaskRow[], sort: SortBy) {
  const r = [...rows];
  switch (sort) {
    case "priority":
      return r.sort((a, b) => PRI_ORDER(a.priority) - PRI_ORDER(b.priority) || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
    case "due":
      return r.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || PRI_ORDER(a.priority) - PRI_ORDER(b.priority));
    case "updated":
      return r.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "created":
      return r.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "title":
      return r.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return r.sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

/* ───────── Workspace ───────── */

export type SavedView = { id: string; name: string; config: ViewConfig; shared: boolean; mine: boolean };

export function TaskWorkspace({
  tasks,
  base: baseIn,
  lock = {},
  savedViews,
  syncUrl = true,
  createDefaults = {},
  layouts = ["list", "board", "calendar", "timeline"],
  compact,
}: {
  tasks: TaskRow[];
  base?: Partial<Omit<View, "filters">> & { filters?: Partial<Filters> };
  /** Filters fixed by the page (e.g. this subteam) — applied but not shown as removable chips. */
  lock?: Partial<Pick<Filters, "subteam" | "project" | "assignee">>;
  savedViews?: SavedView[];
  syncUrl?: boolean;
  createDefaults?: Parameters<ReturnType<typeof useCreateTask>>[0];
  layouts?: Layout[];
  compact?: boolean;
}) {
  const { me } = useApp();
  const base: View = React.useMemo(
    () => ({ layout: "list", groupBy: "status", sort: "manual", ...baseIn, filters: { ...emptyFilters, ...baseIn?.filters } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [view, setView] = React.useState<View>(base);
  const [ready, setReady] = React.useState(!syncUrl);
  React.useEffect(() => {
    if (syncUrl) {
      setView(viewFromParams(new URLSearchParams(location.search), base));
      setReady(true);
    }
  }, [syncUrl, base]);
  React.useEffect(() => {
    if (!syncUrl || !ready) return;
    const q = viewToParams(view, base);
    const cur = new URLSearchParams(location.search);
    if (cur.get("task")) q.set("task", cur.get("task")!);
    const next = `${location.pathname}${q.toString() ? "?" + q.toString() : ""}`;
    if (next !== location.pathname + location.search) history.replaceState(history.state, "", next);
  }, [view, syncUrl, ready, base]);

  // Optimistic local copy
  const [rows, setRows] = React.useState(tasks);
  React.useEffect(() => setRows(tasks), [tasks]);

  const locked = React.useMemo(() => applyFilters(rows, { ...emptyFilters, ...lock }, me.id), [rows, lock, me.id]);
  const visible = React.useMemo(() => sortRows(applyFilters(locked, view.filters, me.id), view.sort), [locked, view, me.id]);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  React.useEffect(() => setSelected((s) => new Set([...s].filter((id) => rows.some((r) => r.id === id)))), [rows]);

  const set = (p: Partial<View>) => setView((v) => ({ ...v, ...p }));
  const setF = (p: Partial<Filters>) => setView((v) => ({ ...v, filters: { ...v.filters, ...p } }));
  const patchRow = (id: string, p: Partial<TaskRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const layoutIcons: Record<Layout, [React.ReactNode, string]> = {
    list: [<List key="l" />, "List"],
    board: [<SquareKanban key="b" />, "Board"],
    calendar: [<CalendarDays key="c" />, "Calendar"],
    timeline: [<ChartGantt key="t" />, "Timeline"],
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("flex flex-wrap items-center gap-1.5 border-b border-line py-2", compact ? "px-0" : "px-4 md:px-6")}>
        {layouts.length > 1 && (
          <div className="mr-1 flex rounded-md border border-line bg-surface p-0.5">
            {layouts.map((l) => (
              <button
                key={l}
                onClick={() => set({ layout: l })}
                className={cn(
                  "flex h-6 items-center gap-1.5 rounded px-2 text-[12.5px] transition-colors [&_svg]:size-3.5",
                  view.layout === l ? "bg-surface-3 font-medium text-fg" : "text-muted hover:text-fg",
                )}
              >
                {layoutIcons[l][0]}
                <span className="hidden sm:inline">{layoutIcons[l][1]}</span>
              </button>
            ))}
          </div>
        )}
        <FilterMenu filters={view.filters} setF={setF} lock={lock} />
        <DisplayMenu view={view} set={set} setF={setF} />
        {savedViews && <ViewsMenu view={view} setView={setView} views={savedViews} base={base} />}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={view.filters.q}
            onChange={(e) => setF({ q: e.target.value })}
            placeholder="Filter by title or ID"
            className="h-7 w-40 rounded-md border border-line bg-surface pl-7 pr-2 text-[12.5px] outline-none placeholder:text-subtle focus:border-line-strong sm:w-52"
          />
        </div>
        <IconButton
          label="Export CSV"
          onClick={() => exportCsv(visible)}
          className="hidden sm:inline-flex"
        >
          <Download />
        </IconButton>
        <NewTaskButton defaults={createDefaults} />
      </div>
      <ActiveFilters filters={view.filters} setF={setF} />

      {!ready ? null : visible.length === 0 && view.layout !== "calendar" && view.layout !== "timeline" ? (
        <Empty icon={<Layers />} title={locked.length ? "No tasks match these filters" : "No tasks yet"}>
          {locked.length ? (
            <button className="underline" onClick={() => setView({ ...view, filters: { ...emptyFilters } })}>
              Clear filters
            </button>
          ) : isLead(me) ? (
            "Press C to create the first one."
          ) : (
            "When a head assigns you something, it shows up here."
          )}
        </Empty>
      ) : view.layout === "list" ? (
        <ListView rows={visible} groupBy={view.groupBy} selected={selected} setSelected={setSelected} patchRow={patchRow} compact={compact} createDefaults={createDefaults} />
      ) : view.layout === "board" ? (
        <BoardView rows={visible} patchRow={patchRow} showClosed={view.filters.showClosed} createDefaults={createDefaults} />
      ) : view.layout === "calendar" ? (
        <CalendarView rows={visible} />
      ) : (
        <TimelineView rows={visible} groupBy={view.groupBy === "status" ? "project" : view.groupBy} />
      )}

      {selected.size > 0 && <BulkBar ids={[...selected]} clear={() => setSelected(new Set())} rows={rows} />}
    </div>
  );
}

function NewTaskButton({ defaults }: { defaults: Parameters<ReturnType<typeof useCreateTask>>[0] }) {
  const { me } = useApp();
  const create = useCreateTask();
  if (!isLead(me)) return null;
  return (
    <Button size="sm" variant="primary" onClick={() => create(defaults)}>
      <Plus />
      New task
    </Button>
  );
}

function exportCsv(rows: TaskRow[]) {
  const header = ["ID", "Title", "Status", "Priority", "Due", "Start", "Estimate (h)", "Logged (h)", "Labels"];
  const body = rows.map((t) => [t.number, t.title, statusLabel(t.status), priorityLabel(t.priority), t.dueDate, t.startDate, t.estimateHours, (t.minutes / 60).toFixed(1), t.labels.join("; ")]);
  const blob = new Blob([csv([header, ...body])], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tasks-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
}

/* ───────── Toolbar menus ───────── */

function useFilterOptions() {
  const { dir, activePeople, settings } = useApp();
  return {
    status: { label: "Status", options: STATUSES.map((s) => ({ value: s.id, label: s.label, icon: <StatusIcon status={s.id} /> })) },
    priority: { label: "Priority", options: PRIORITIES.map((p) => ({ value: String(p.id), label: p.label, icon: <PriorityIcon priority={p.id} /> })) },
    assignee: {
      label: "Assignee",
      options: [
        { value: "me", label: "Me" },
        { value: "none", label: "Unassigned" },
        ...activePeople.map((p) => ({ value: p.id, label: p.name, icon: <Avatar id={p.id} name={p.name} size={16} /> })),
      ],
    },
    subteam: { label: "Subteam", options: dir.teams.map((t) => ({ value: t.id, label: t.name, icon: <Dot color={t.color} /> })) },
    project: { label: "Project", options: [{ value: "none", label: "No project" }, ...dir.projects.map((p) => ({ value: p.id, label: p.name }))] },
    label: { label: "Label", options: settings.labels.map((l) => ({ value: l, label: l })) },
    due: {
      label: "Due date",
      options: [
        { value: "overdue", label: "Overdue" },
        { value: "today", label: "Due today" },
        { value: "week", label: "Due within 7 days" },
        { value: "month", label: "Due within 30 days" },
        { value: "none", label: "No due date" },
      ],
    },
  };
}

function FilterMenu({ filters, setF, lock }: { filters: Filters; setF: (p: Partial<Filters>) => void; lock: Partial<Filters> }) {
  const opts = useFilterOptions();
  const [cat, setCat] = React.useState<(typeof LIST_KEYS)[number] | null>(null);
  const keys = LIST_KEYS.filter((k) => !(k in lock));
  const count = keys.reduce((a, k) => a + (filters[k].length ? 1 : 0), 0);
  return (
    <Popover onOpenChange={() => setCat(null)}>
      <PopoverTrigger asChild>
        <Chip active={count > 0}>
          <ListFilter />
          Filter
          {count > 0 && <span className="tabular rounded bg-fg px-1 text-[10.5px] text-bg">{count}</span>}
        </Chip>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        {!cat ? (
          keys.map((k) => (
            <button key={k} onClick={() => setCat(k)} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-surface-2">
              <span className="flex-1">{opts[k].label}</span>
              {filters[k].length > 0 && <span className="text-xs text-muted">{filters[k].length}</span>}
              <ChevronRight className="size-3.5 text-subtle" />
            </button>
          ))
        ) : (
          <FilterOptions
            title={opts[cat].label}
            options={opts[cat].options}
            value={filters[cat]}
            onBack={() => setCat(null)}
            onChange={(v) => setF({ [cat]: v } as Partial<Filters>)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterOptions({
  title,
  options,
  value,
  onChange,
  onBack,
}: {
  title: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string[];
  onChange: (v: string[]) => void;
  onBack: () => void;
}) {
  const [q, setQ] = React.useState("");
  const list = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex items-center gap-1 border-b border-line pb-1">
        <IconButton label="Back" onClick={onBack} className="size-6">
          <ChevronLeft />
        </IconButton>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={title} className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle" />
      </div>
      <div className="max-h-72 overflow-y-auto pt-1">
        {list.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-surface-2"
            >
              <span className={cn("flex size-3.5 items-center justify-center rounded border", on ? "border-fg bg-fg text-bg" : "border-line-strong")}>{on && <Check className="size-2.5" />}</span>
              {o.icon && <span className="flex w-4 justify-center">{o.icon}</span>}
              <span className="flex-1 truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActiveFilters({ filters, setF }: { filters: Filters; setF: (p: Partial<Filters>) => void }) {
  const opts = useFilterOptions();
  const active = LIST_KEYS.filter((k) => filters[k].length);
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-1.5 md:px-6">
      {active.map((k) => {
        const labels = filters[k].map((v) => opts[k].options.find((o) => o.value === v)?.label ?? v);
        return (
          <span key={k} className="inline-flex h-6 items-center overflow-hidden rounded-md border border-line bg-surface text-xs">
            <span className="px-2 text-muted">{opts[k].label}</span>
            <span className="border-l border-line px-2 text-subtle">{filters[k].length > 1 ? "is any of" : "is"}</span>
            <span className="max-w-[260px] truncate border-l border-line px-2">{labels.join(", ")}</span>
            <button aria-label="Remove filter" onClick={() => setF({ [k]: [] } as Partial<Filters>)} className="flex h-full items-center border-l border-line px-1.5 text-subtle hover:bg-surface-2 hover:text-fg">
              <X className="size-3" />
            </button>
          </span>
        );
      })}
      <button className="ml-1 text-xs text-muted hover:text-fg" onClick={() => setF(Object.fromEntries(LIST_KEYS.map((k) => [k, []])) as Partial<Filters>)}>
        Clear all
      </button>
    </div>
  );
}

function DisplayMenu({ view, set, setF }: { view: View; set: (p: Partial<View>) => void; setF: (p: Partial<Filters>) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Chip>
          <SlidersHorizontal />
          Display
        </Chip>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3 p-3">
        <div className="grid grid-cols-[80px_1fr] items-center gap-2">
          <span className="text-xs text-muted">Group by</span>
          <Select value={view.groupBy} onChange={(e) => set({ groupBy: e.target.value as GroupBy })} className="h-7 text-xs">
            <option value="status">Status</option>
            <option value="assignee">Assignee</option>
            <option value="subteam">Subteam</option>
            <option value="project">Project</option>
            <option value="priority">Priority</option>
            <option value="due">Due date</option>
            <option value="none">No grouping</option>
          </Select>
          <span className="text-xs text-muted">Order by</span>
          <Select value={view.sort} onChange={(e) => set({ sort: e.target.value as SortBy })} className="h-7 text-xs">
            <option value="manual">Manual</option>
            <option value="priority">Priority</option>
            <option value="due">Due date</option>
            <option value="updated">Last updated</option>
            <option value="created">Newest</option>
            <option value="title">Title</option>
          </Select>
        </div>
        <div className="space-y-2 border-t border-line pt-3">
          <Toggle checked={view.filters.showClosed} onChange={(v) => setF({ showClosed: v })} label="Show completed & cancelled" />
          <Toggle checked={view.filters.showSubtasks} onChange={(v) => setF({ showSubtasks: v })} label="Show subtasks" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ViewsMenu({ view, setView, views, base }: { view: View; setView: (v: View) => void; views: SavedView[]; base: View }) {
  const { me } = useApp();
  const { run } = useAction();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [shared, setShared] = React.useState(false);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Chip caret>
            <Bookmark />
            Views
          </Chip>
        </MenuTrigger>
        <MenuContent className="w-64">
          {views.length > 0 && <MenuLabel>Saved views</MenuLabel>}
          {views.map((v) => (
            <MenuItem key={v.id} onSelect={() => setView({ ...base, ...(v.config as unknown as View), filters: { ...emptyFilters, ...(v.config.filters as Partial<Filters>) } })}>
              <span className="flex items-center gap-2">
                {v.name}
                {v.shared && <Badge>Team</Badge>}
              </span>
            </MenuItem>
          ))}
          {views.length > 0 && <MenuSeparator />}
          <MenuItem icon={<Plus />} onSelect={() => setSaving(true)}>
            Save current view…
          </MenuItem>
          <MenuItem
            icon={<Link2 />}
            onSelect={() => {
              navigator.clipboard.writeText(location.href);
              toast("Link to this view copied");
            }}
          >
            Copy link to view
          </MenuItem>
          <MenuItem icon={<X />} onSelect={() => setView(base)}>
            Reset to default
          </MenuItem>
          {views.some((v) => v.mine || me.isAdmin) && <MenuSeparator />}
          {views
            .filter((v) => v.mine || me.isAdmin)
            .map((v) => (
              <MenuItem key={"d" + v.id} danger icon={<Trash2 />} onSelect={() => confirm(`Delete view “${v.name}”?`) && run(() => deleteView(v.id))}>
                Delete “{v.name}”
              </MenuItem>
            ))}
        </MenuContent>
      </Menu>
      <Dialog
        open={saving}
        onOpenChange={setSaving}
        title="Save view"
        description="Saves the current layout, grouping, ordering and filters."
        footer={
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() =>
              run(() => saveView(name, view as unknown as ViewConfig, shared), {
                success: "View saved",
                then: () => {
                  setSaving(false);
                  setName("");
                },
              })
            }
          >
            Save
          </Button>
        }
      >
        <div className="space-y-3 pb-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electrical — this week" className="input" />
          {isLead(me) && <Toggle checked={shared} onChange={setShared} label="Share with the whole team" />}
        </div>
      </Dialog>
    </>
  );
}

/* ───────── Grouping ───────── */

type Group = { id: string; label: string; icon?: React.ReactNode; rows: TaskRow[] };

function useGroups(rows: TaskRow[], groupBy: GroupBy): Group[] {
  const { dir, person, me } = useApp();
  return React.useMemo(() => {
    const by = <K extends string>(keys: { id: K; label: string; icon?: React.ReactNode }[], fn: (t: TaskRow) => K | K[]) =>
      keys
        .map((k) => ({ ...k, rows: rows.filter((t) => [fn(t)].flat().includes(k.id)) }))
        .filter((g) => g.rows.length);
    switch (groupBy) {
      case "status":
        return by(STATUSES.map((s) => ({ id: s.id, label: s.label, icon: <StatusIcon status={s.id} /> })), (t) => t.status);
      case "priority":
        return by(PRIORITIES.map((p) => ({ id: String(p.id), label: p.label, icon: <PriorityIcon priority={p.id} /> })), (t) => String(t.priority));
      case "subteam":
        return by(dir.teams.map((t) => ({ id: t.id, label: t.name, icon: <Dot color={t.color} /> })), (t) => t.subteamId);
      case "project":
        return by([...dir.projects.map((p) => ({ id: p.id, label: p.name })), { id: "none", label: "No project" }], (t) => t.projectId ?? "none");
      case "due":
        return by(DUE_GROUPS, dueBucket);
      case "assignee": {
        const ids = [...new Set(rows.flatMap((t) => t.assigneeIds))].sort((a, b) => (a === me.id ? -1 : b === me.id ? 1 : (person(a)?.name ?? "").localeCompare(person(b)?.name ?? "")));
        return by(
          [
            ...ids.map((id) => ({ id, label: person(id)?.name ?? "Unknown", icon: <Avatar id={id} name={person(id)?.name ?? "?"} size={16} /> })),
            { id: "none", label: "Unassigned" },
          ],
          (t) => (t.assigneeIds.length ? t.assigneeIds : "none"),
        );
      }
      default:
        return [{ id: "all", label: "All tasks", rows }];
    }
  }, [rows, groupBy, dir, person, me.id]);
}

/* ───────── List ───────── */

function ListView({
  rows,
  groupBy,
  selected,
  setSelected,
  patchRow,
  compact,
  createDefaults,
}: {
  rows: TaskRow[];
  groupBy: GroupBy;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  patchRow: (id: string, p: Partial<TaskRow>) => void;
  compact?: boolean;
  createDefaults: Parameters<ReturnType<typeof useCreateTask>>[0];
}) {
  const groups = useGroups(rows, groupBy);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set(["done", "cancelled"].filter(() => groupBy === "status")));
  const { me } = useApp();
  const create = useCreateTask();
  const selectable = isLead(me);
  return (
    <div className={cn("pb-24", compact && "-mx-2")}>
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.id);
        const allSel = g.rows.every((r) => selected.has(r.id));
        return (
          <section key={g.id}>
            {groupBy !== "none" && (
              <div className={cn("group sticky top-12 z-10 flex h-9 items-center gap-2 border-b border-line bg-surface-2/80 backdrop-blur", compact ? "px-2" : "px-4 md:px-6")}>
                <button
                  onClick={() =>
                    setCollapsed((c) => {
                      const n = new Set(c);
                      if (n.has(g.id)) n.delete(g.id);
                      else n.add(g.id);
                      return n;
                    })
                  }
                  className="flex items-center gap-2 text-[13px] font-medium"
                >
                  <ChevronDown className={cn("size-3.5 text-subtle transition-transform", isCollapsed && "-rotate-90")} />
                  {g.icon}
                  {g.label}
                  <span className="tabular font-normal text-subtle">{g.rows.length}</span>
                </button>
                {selectable && (
                  <button
                    className="ml-1 text-xs text-subtle opacity-0 hover:text-fg group-hover:opacity-100"
                    onClick={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        g.rows.forEach((r) => (allSel ? n.delete(r.id) : n.add(r.id)));
                        return n;
                      })
                    }
                  >
                    {allSel ? "Deselect" : "Select all"}
                  </button>
                )}
                {selectable && groupBy === "status" && (
                  <IconButton label="Add task" className="ml-auto size-6 opacity-0 group-hover:opacity-100" onClick={() => create({ ...createDefaults, status: g.id as TaskStatus })}>
                    <Plus />
                  </IconButton>
                )}
              </div>
            )}
            {!isCollapsed && g.rows.map((t) => <TaskLine key={t.id + g.id} t={t} selected={selected.has(t.id)} selectable={selectable} compact={compact} setSelected={setSelected} patchRow={patchRow} />)}
          </section>
        );
      })}
    </div>
  );
}

function TaskLine({
  t,
  selected,
  selectable,
  setSelected,
  patchRow,
  compact,
}: {
  t: TaskRow;
  selected: boolean;
  selectable: boolean;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  patchRow: (id: string, p: Partial<TaskRow>) => void;
  compact?: boolean;
}) {
  const { taskKey, project, me } = useApp();
  const open = useOpenTask();
  const { run } = useAction();
  const canEdit = canEditTask(me, t);
  const canWork = canEdit || t.assigneeIds.includes(me.id);
  const p = project(t.projectId);
  return (
    <div
      onClick={() => open(t.number)}
      className={cn(
        "group flex h-10 cursor-default items-center gap-2 border-b border-line/70 text-[13px] transition-colors hover:bg-surface-2/70",
        compact ? "px-2" : "px-4 md:px-6",
        selected && "bg-accent-soft/60 hover:bg-accent-soft",
      )}
    >
      {selectable && (
        <button
          aria-label="Select"
          onClick={(e) => {
            e.stopPropagation();
            setSelected((s) => {
              const n = new Set(s);
              if (n.has(t.id)) n.delete(t.id);
              else n.add(t.id);
              return n;
            });
          }}
          className={cn("-ml-1 flex size-4 shrink-0 items-center justify-center rounded border transition-opacity", selected ? "border-accent bg-accent text-white" : "border-line-strong opacity-0 group-hover:opacity-100")}
        >
          {selected && <Check className="size-3" />}
        </button>
      )}
      <span onClick={(e) => e.stopPropagation()}>
        <PriorityPicker compact value={t.priority} disabled={!canEdit} onChange={(priority) => (patchRow(t.id, { priority }), run(() => updateTask(t.id, { priority })))} />
      </span>
      <span className="hidden w-14 shrink-0 font-mono text-[11.5px] text-subtle sm:inline">{taskKey(t)}</span>
      <span onClick={(e) => e.stopPropagation()}>
        <StatusPicker compact value={t.status} disabled={!canWork} onChange={(status) => (patchRow(t.id, { status }), run(() => updateTask(t.id, { status })))} />
      </span>
      <span className={cn("min-w-0 flex-1 truncate", isClosed(t.status) && "text-muted")}>
        {t.parentId && <span className="mr-1 text-subtle">↳</span>}
        {t.title}
      </span>
      {t.openBlockers > 0 && <Badge tone="red">Blocked by {t.openBlockers}</Badge>}
      {t.subtasks > 0 && (
        <span className="tabular hidden text-xs text-muted sm:inline">
          {t.subtasksDone}/{t.subtasks}
        </span>
      )}
      <span className="hidden gap-1 lg:flex">
        {t.labels.slice(0, 2).map((l) => (
          <span key={l} className="rounded-full border border-line px-1.5 text-[11px] leading-[18px] text-muted">
            {l}
          </span>
        ))}
      </span>
      {p && <span className="hidden max-w-[160px] truncate text-xs text-muted xl:inline">{p.name}</span>}
      {t.minutes > 0 && <span className="tabular hidden w-12 text-right text-xs text-subtle md:inline">{hours(t.minutes)}</span>}
      <DueLabel date={t.dueDate} status={t.status} className="w-16 justify-end" />
      <span onClick={(e) => e.stopPropagation()} className="flex w-14 justify-end">
        <AssigneePicker compact value={t.assigneeIds} subteamId={t.subteamId} disabled={!canEdit} onChange={(ids) => (patchRow(t.id, { assigneeIds: ids }), run(() => setAssignees(t.id, ids)))} />
      </span>
    </div>
  );
}

function BulkBar({ ids, clear, rows }: { ids: string[]; clear: () => void; rows: TaskRow[] }) {
  const { run, pending } = useAction();
  const toast = useToast();
  const exec = (patch: Parameters<typeof bulkUpdate>[1]) =>
    run(() => bulkUpdate(ids, patch), {
      then: (r) => {
        if (r.ok && r.data.skipped) toast(`${r.data.skipped} task(s) skipped — you can't edit them.`);
        if (patch.delete) clear();
      },
    });
  const { activePeople } = useApp();
  const dueRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="anim-pop fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-pop md:ml-[116px]">
      <span className="px-2 text-[13px] font-medium">{ids.length} selected</span>
      <Picker options={STATUSES.map((s) => ({ value: s.id, label: s.label, icon: <StatusIcon status={s.id} /> }))} value={null} onChange={(v) => exec({ status: v as TaskStatus })} trigger={<Chip disabled={pending}>Status</Chip>} />
      <Picker options={PRIORITIES.map((p) => ({ value: p.id, label: p.label, icon: <PriorityIcon priority={p.id} /> }))} value={null} onChange={(v) => exec({ priority: v as TaskPriority })} trigger={<Chip disabled={pending}>Priority</Chip>} />
      <Picker options={activePeople.map((p) => ({ value: p.id, label: p.name, icon: <Avatar id={p.id} name={p.name} size={16} /> }))} value={null} onChange={(v) => exec({ assigneeId: v as string })} trigger={<Chip disabled={pending}>Assign</Chip>} />
      <span className="relative">
        <Chip disabled={pending} onClick={() => dueRef.current?.showPicker()}>
          Due
        </Chip>
        <input ref={dueRef} type="date" className="pointer-events-none absolute inset-0 opacity-0" tabIndex={-1} onChange={(e) => exec({ dueDate: e.target.value || null })} />
      </span>
      <IconButton label="Delete selected" disabled={pending} onClick={() => confirm(`Delete ${ids.length} task(s)? This can't be undone.`) && exec({ delete: true })} className="hover:text-bad">
        <Trash2 />
      </IconButton>
      <IconButton label="Clear selection" onClick={clear}>
        <X />
      </IconButton>
      <span className="sr-only">{rows.length}</span>
    </div>
  );
}

/* ───────── Board ───────── */

function BoardView({
  rows,
  patchRow,
  showClosed,
  createDefaults,
}: {
  rows: TaskRow[];
  patchRow: (id: string, p: Partial<TaskRow>) => void;
  showClosed: boolean;
  createDefaults: Parameters<ReturnType<typeof useCreateTask>>[0];
}) {
  const { me } = useApp();
  const { run } = useAction();
  const toast = useToast();
  const create = useCreateTask();
  const [drag, setDrag] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);
  const cols = STATUSES.filter((s) => showClosed || !isClosed(s.id)).filter((s) => s.id !== "cancelled" || rows.some((r) => r.status === "cancelled"));

  const drop = (status: TaskStatus, beforeId: string | null) => {
    const t = rows.find((r) => r.id === drag);
    setDrag(null);
    setOver(null);
    if (!t) return;
    if (!canEditTask(me, t) && !t.assigneeIds.includes(me.id)) return toast("You can only move tasks assigned to you.", "error");
    const col = rows.filter((r) => r.status === status && r.id !== t.id).sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = beforeId ? col.findIndex((r) => r.id === beforeId) : col.length;
    const prev = col[idx - 1]?.sortOrder;
    const next = col[idx]?.sortOrder;
    const sortOrder = prev === undefined && next === undefined ? t.sortOrder : prev === undefined ? next! - 1 : next === undefined ? prev + 1 : (prev + next) / 2;
    patchRow(t.id, { status, sortOrder });
    run(() => moveTask(t.id, status, sortOrder));
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 py-4 md:px-6">
      {cols.map((c) => {
        const items = rows.filter((r) => r.status === c.id).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <div
            key={c.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(c.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(c.id, null);
            }}
            className={cn("flex w-[272px] shrink-0 flex-col rounded-lg bg-surface-2/60 transition-colors", over === c.id && "bg-surface-3")}
          >
            <div className="flex h-10 items-center gap-2 px-3 text-[13px] font-medium">
              <StatusIcon status={c.id} />
              {c.label}
              <span className="tabular font-normal text-subtle">{items.length}</span>
              {isLead(me) && (
                <IconButton label="Add task" className="ml-auto size-6" onClick={() => create({ ...createDefaults, status: c.id })}>
                  <Plus />
                </IconButton>
              )}
            </div>
            <div className="flex min-h-[80px] flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-2">
              {items.map((t) => (
                <BoardCard key={t.id} t={t} dragging={drag === t.id} onDragStart={() => setDrag(t.id)} onDropBefore={() => drop(c.id, t.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoardCard({ t, dragging, onDragStart, onDropBefore }: { t: TaskRow; dragging: boolean; onDragStart: () => void; onDropBefore: () => void }) {
  const { taskKey, person, project, team } = useApp();
  const open = useOpenTask();
  const people = t.assigneeIds.map((id) => person(id)).filter(Boolean) as { id: string; name: string }[];
  const p = project(t.projectId);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropBefore();
      }}
      onClick={() => open(t.number)}
      className={cn("cursor-grab rounded-md border border-line bg-surface p-2.5 shadow-[0_1px_1px_rgb(0_0_0/0.03)] transition-shadow hover:border-line-strong active:cursor-grabbing", dragging && "opacity-40")}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ background: team(t.subteamId)?.color }} />
        <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-subtle">{taskKey(t)}</span>
        <span className="ml-auto">
          <PriorityIcon priority={t.priority} size={13} />
        </span>
      </div>
      <div className={cn("text-[13px] leading-snug", isClosed(t.status) && "text-muted line-through")}>{t.title}</div>
      {(t.labels.length > 0 || p) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {p && <span className="max-w-full truncate rounded border border-line px-1.5 text-[11px] leading-[18px] text-muted">{p.name}</span>}
          {t.labels.map((l) => (
            <span key={l} className="rounded-full border border-line px-1.5 text-[11px] leading-[18px] text-muted">
              {l}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <DueLabel date={t.dueDate} status={t.status} />
        {t.openBlockers > 0 && <Badge tone="red">Blocked</Badge>}
        {t.subtasks > 0 && (
          <span className="tabular text-[11px] text-muted">
            {t.subtasksDone}/{t.subtasks}
          </span>
        )}
        <span className="ml-auto">
          <AvatarStack people={people} size={18} />
        </span>
      </div>
    </div>
  );
}

/* ───────── Calendar ───────── */

export function CalendarView({ rows, events = [], onDayClick }: { rows: TaskRow[]; events?: { id: string; title: string; startsAt: string; color: string; onClick?: () => void }[]; onDayClick?: (iso: string) => void }) {
  const { team } = useApp();
  const open = useOpenTask();
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 6 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 6 }) });
  const byDay = new Map<string, TaskRow[]>();
  for (const t of rows) if (t.dueDate) byDay.set(t.dueDate, [...(byDay.get(t.dueDate) ?? []), t]);
  const evByDay = new Map<string, typeof events>();
  for (const e of events) {
    const k = format(parseISO(e.startsAt), "yyyy-MM-dd");
    evByDay.set(k, [...(evByDay.get(k) ?? []), e]);
  }
  const undated = rows.filter((r) => !r.dueDate && !isClosed(r.status)).length;
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-3 md:px-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="w-40 text-[15px] font-semibold">{format(month, "MMMM yyyy")}</h2>
        <IconButton label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft />
        </IconButton>
        <Button size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
          Today
        </Button>
        <IconButton label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight />
        </IconButton>
        {undated > 0 && <span className="ml-auto text-xs text-subtle">{undated} open tasks without a due date</span>}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line bg-line gap-px">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="bg-surface-2 px-2 py-1.5 text-[11px] font-medium text-muted">
            {format(d, "EEE")}
          </div>
        ))}
        {days.map((d) => {
          const k = format(d, "yyyy-MM-dd");
          const list = byDay.get(k) ?? [];
          const evs = evByDay.get(k) ?? [];
          return (
            <div
              key={k}
              onDoubleClick={() => onDayClick?.(k)}
              className={cn("min-h-[104px] bg-surface p-1.5", !isSameMonth(d, month) && "bg-surface/60 text-subtle")}
            >
              <div className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs", isToday(d) && "bg-accent font-semibold text-white")}>{format(d, "d")}</div>
              <div className="space-y-0.5">
                {evs.map((e) => (
                  <button key={e.id} onClick={e.onClick} className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11.5px] font-medium hover:bg-surface-2" style={{ color: e.color }}>
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                    <span className="truncate">{e.title}</span>
                  </button>
                ))}
                {list.slice(0, 4).map((t) => (
                  <button key={t.id} onClick={() => open(t.number)} className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11.5px] hover:bg-surface-2">
                    <StatusIcon status={t.status} size={11} />
                    <span className={cn("truncate", isClosed(t.status) && "text-muted line-through")} style={{ borderLeft: `2px solid ${team(t.subteamId)?.color}`, paddingLeft: 4 }}>
                      {t.title}
                    </span>
                  </button>
                ))}
                {list.length > 4 && <div className="px-1 text-[11px] text-subtle">+{list.length - 4} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Timeline ───────── */

function TimelineView({ rows, groupBy }: { rows: TaskRow[]; groupBy: GroupBy }) {
  const { taskKey, team } = useApp();
  const open = useOpenTask();
  const groups = useGroups(
    rows.filter((r) => r.dueDate || r.startDate),
    groupBy,
  );
  const DAY = 26;
  const today = new Date();
  const dated = rows.filter((r) => r.dueDate || r.startDate);
  const allDates = dated.flatMap((r) => [r.startDate, r.dueDate]).filter(Boolean).map((d) => parseISO(d!));
  const min = new Date(Math.min(addDays(today, -14).getTime(), ...allDates.map((d) => d.getTime())));
  const max = new Date(Math.max(addDays(today, 45).getTime(), ...allDates.map((d) => d.getTime())));
  const start = startOfWeek(addDays(min, -3), { weekStartsOn: 6 });
  const days = eachDayOfInterval({ start, end: addDays(max, 7) });
  const width = days.length * DAY;
  const x = (d: Date) => differenceInCalendarDays(d, start) * DAY;
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, x(today) - 260);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!dated.length) return <Empty icon={<ChartGantt />} title="Nothing to plot">Give tasks a start or due date to see them on the timeline.</Empty>;
  return (
    <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto">
      <div style={{ width: width + 280 }} className="relative">
        {/* header */}
        <div className="sticky top-0 z-20 flex h-12 border-b border-line bg-bg">
          <div className="sticky left-0 z-10 w-[280px] shrink-0 border-r border-line bg-bg" />
          <div className="relative" style={{ width }}>
            {days.map((d, i) =>
              d.getDate() === 1 || i === 0 ? (
                <div key={"m" + i} className="absolute top-1 text-[11px] font-medium" style={{ left: i * DAY + 4 }}>
                  {format(d, "MMMM")}
                </div>
              ) : null,
            )}
            {days.map((d, i) => (
              <div key={i} className={cn("absolute bottom-1 w-[26px] text-center text-[10.5px]", isToday(d) ? "font-semibold text-accent" : "text-subtle")} style={{ left: i * DAY }}>
                {format(d, "d")}
              </div>
            ))}
          </div>
        </div>
        {/* grid */}
        <div className="pointer-events-none absolute bottom-0 top-12" style={{ left: 280, width }}>
          {days.map((d, i) => (d.getDay() === 5 || d.getDay() === 6) && <div key={i} className="absolute inset-y-0 bg-surface-2/60" style={{ left: i * DAY, width: DAY }} />)}
          <div className="absolute inset-y-0 w-px bg-accent" style={{ left: x(today) + DAY / 2 }} />
        </div>
        {groups.map((g) => (
          <div key={g.id}>
            <div className="sticky left-0 flex h-8 w-[280px] items-center gap-2 border-b border-r border-line bg-surface-2 px-4 text-xs font-medium">
              {g.icon}
              {g.label}
              <span className="font-normal text-subtle">{g.rows.length}</span>
            </div>
            {g.rows.map((t) => {
              const s = parseISO(t.startDate ?? t.dueDate!);
              const e = parseISO(t.dueDate ?? t.startDate!);
              const left = x(s);
              const w = Math.max(DAY, (differenceInCalendarDays(e, s) + 1) * DAY);
              const color = team(t.subteamId)?.color ?? "var(--fg)";
              const overdue = t.dueDate && !isClosed(t.status) && daysUntil(t.dueDate) < 0;
              return (
                <div key={t.id} className="flex h-9 border-b border-line/60">
                  <button onClick={() => open(t.number)} className="sticky left-0 z-10 flex w-[280px] shrink-0 items-center gap-2 border-r border-line bg-bg px-4 text-left text-[12.5px] hover:bg-surface-2">
                    <StatusIcon status={t.status} size={12} />
                    <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-subtle">{taskKey(t)}</span>
                    <span className="truncate">{t.title}</span>
                  </button>
                  <div className="relative" style={{ width }}>
                    <button
                      onClick={() => open(t.number)}
                      title={`${t.title}${t.startDate ? ` · ${t.startDate}` : ""} → ${t.dueDate ?? ""}`}
                      className={cn("absolute top-1.5 flex h-6 items-center overflow-hidden rounded-md px-2 text-[11.5px] font-medium text-white", isClosed(t.status) && "opacity-45", overdue && "ring-2 ring-bad ring-offset-1 ring-offset-bg")}
                      style={{ left, width: w, background: color }}
                    >
                      <span className="truncate">{w > 80 ? t.title : ""}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
