"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  House,
  Inbox,
  CircleUser,
  Layers,
  FolderKanban,
  CalendarDays,
  Users,
  Wallet,
  Package,
  Shield,
  Search,
  Plus,
  Menu as MenuIcon,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Square,
  ChartGantt,
} from "lucide-react";
import { useApp } from "./app-context";
import { cn, hours } from "@/lib/utils";
import { isLead, seesFinance } from "@/lib/perm";
import { Avatar, Kbd, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, ToastProvider, useAction } from "./ui";
import { logout } from "@/lib/actions/misc";
import { stopTimer } from "@/lib/actions/tasks";
import { CommandPalette } from "./palette";
import { CreateTaskProvider, useCreateTask } from "./task-create";
import { TaskSheetHost } from "./task-detail";

type Timer = { taskId: string; startedAt: string; number: number; title: string; subteamId: string } | null;

export function Shell({ children, unread, timer }: { children: React.ReactNode; unread: number; timer: Timer }) {
  return (
    <ToastProvider>
      <CreateTaskProvider>
        <Frame unread={unread} timer={timer}>
          {children}
        </Frame>
        <React.Suspense>
          <TaskSheetHost />
        </React.Suspense>
      </CreateTaskProvider>
    </ToastProvider>
  );
}

function Frame({ children, unread, timer }: { children: React.ReactNode; unread: number; timer: Timer }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const path = usePathname();
  const { me } = useApp();
  const createTask = useCreateTask();

  React.useEffect(() => setMobileOpen(false), [path]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "c" && isLead(me) && !document.querySelector("[role=dialog]")) {
        e.preventDefault();
        createTask({});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [me, createTask]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-[232px] shrink-0 border-r border-line bg-bg md:flex">
        <Sidebar unread={unread} timer={timer} onSearch={() => setPaletteOpen(true)} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="anim-fade absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="anim-slide absolute inset-y-0 left-0 flex w-[260px] border-r border-line bg-bg">
            <Sidebar unread={unread} timer={timer} onSearch={() => setPaletteOpen(true)} />
          </aside>
        </div>
      )}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-2.5 z-30 inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 md:hidden"
      >
        <MenuIcon className="size-4" />
      </button>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function NavLink({ href, icon, label, count, exact, color }: { href: string; icon?: React.ReactNode; label: string; count?: number; exact?: boolean; color?: string }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-7 items-center gap-2 rounded-md px-2 text-[13px] transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        active ? "bg-surface-3 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {color ? <span className="flex size-4 items-center justify-center"><span className="size-2.5 rounded-[3px]" style={{ background: color }} /></span> : icon}
      <span className="flex-1 truncate">{label}</span>
      {!!count && <span className="tabular rounded-full bg-accent px-1.5 text-[10.5px] font-semibold leading-4 text-white">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-1 px-2 text-[11px] font-medium text-subtle">{title}</div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function Sidebar({ unread, timer, onSearch }: { unread: number; timer: Timer; onSearch: () => void }) {
  const { me, dir } = useApp();
  const createTask = useCreateTask();
  const myTeams = new Set(me.memberships.map((m) => m.subteamId));
  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex h-12 items-center gap-2 px-3">
        <img src="/brand/mark-dark.png" alt="" className="size-6 dark:hidden" />
        <img src="/brand/mark-white.png" alt="" className="hidden size-6 dark:block" />
        <span className="truncate text-[13px] font-semibold tracking-tight">Overflow</span>
      </div>
      <div className="flex gap-1.5 px-3">
        <button
          onClick={onSearch}
          className="flex h-7 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-2 text-[12.5px] text-subtle transition-colors hover:text-muted"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search</span>
          <Kbd>⌘K</Kbd>
        </button>
        {isLead(me) && (
          <button
            onClick={() => createTask({})}
            title="New task (C)"
            aria-label="New task"
            className="flex size-7 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-fg"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
        <div className="space-y-px">
          <NavLink href="/" exact icon={<House />} label="Home" />
          <NavLink href="/my-tasks" icon={<CircleUser />} label="My tasks" />
          <NavLink href="/inbox" icon={<Inbox />} label="Inbox" count={unread} />
        </div>
        <Section title="Workspace">
          <NavLink href="/tasks" icon={<Layers />} label="All tasks" />
          <NavLink href="/projects" icon={<FolderKanban />} label="Projects" />
          <NavLink href="/timeline" icon={<ChartGantt />} label="Timeline" />
          <NavLink href="/calendar" icon={<CalendarDays />} label="Calendar" />
          <NavLink href="/people" icon={<Users />} label="People" />
        </Section>
        <Section title="Subteams">
          {[...dir.teams]
            .sort((a, b) => Number(myTeams.has(b.id)) - Number(myTeams.has(a.id)))
            .map((t) => (
              <NavLink key={t.id} href={`/teams/${t.slug}`} color={t.color} label={t.name} />
            ))}
        </Section>
        <Section title="Operations">
          <NavLink href="/finance" icon={<Wallet />} label={seesFinance(me) ? "Finance" : "Purchases"} />
          <NavLink href="/inventory" icon={<Package />} label="Inventory" />
          {me.isAdmin && <NavLink href="/admin" icon={<Shield />} label="Admin" />}
        </Section>
      </nav>

      {timer && <TimerPill timer={timer} />}
      <UserMenu />
    </div>
  );
}

function TimerPill({ timer }: { timer: NonNullable<Timer> }) {
  const { taskKey } = useApp();
  const { run, pending } = useAction();
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(i);
  }, []);
  const mins = Math.max(0, Math.floor((now - new Date(timer.startedAt).getTime()) / 60000));
  return (
    <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50" />
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
      <Link href={`?task=${timer.number}`} scroll={false} className="min-w-0 flex-1 truncate text-xs">
        <span className="text-muted">{taskKey(timer)}</span> {timer.title}
      </Link>
      <span className="tabular text-xs text-muted">{hours(mins)}</span>
      <button
        disabled={pending}
        onClick={() => run(stopTimer, { success: "Time logged" })}
        aria-label="Stop timer"
        title="Stop timer"
        className="flex size-5 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
      >
        <Square className="size-3 fill-current" />
      </button>
    </div>
  );
}

function UserMenu() {
  const { me, dir } = useApp();
  const [theme, setThemeState] = React.useState<string>("system");
  React.useEffect(() => {
    try {
      setThemeState(localStorage.getItem("theme") ?? "system");
    } catch {}
  }, []);
  const setTheme = (t: string) => {
    try {
      localStorage.setItem("theme", t);
    } catch {}
    setThemeState(t);
    const d = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", d);
  };
  const primary = me.memberships[0];
  const team = dir.teams.find((t) => t.id === primary?.subteamId);
  return (
    <div className="border-t border-line p-2">
      <Menu>
        <MenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left outline-none hover:bg-surface-2">
            <Avatar id={me.id} name={me.name} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{me.name}</span>
              <span className="block truncate text-[11.5px] text-subtle">{me.isAdmin ? "Admin" : (me.title ?? team?.name ?? "Member")}</span>
            </span>
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="w-56">
          <Link href={`/people/${me.id}`}>
            <MenuItem icon={<CircleUser />}>Profile</MenuItem>
          </Link>
          <Link href="/settings">
            <MenuItem icon={<Settings />}>Settings</MenuItem>
          </Link>
          <MenuSeparator />
          <MenuItem icon={<Sun />} checked={theme === "light"} onSelect={() => setTheme("light")}>
            Light
          </MenuItem>
          <MenuItem icon={<Moon />} checked={theme === "dark"} onSelect={() => setTheme("dark")}>
            Dark
          </MenuItem>
          <MenuItem icon={<Monitor />} checked={theme === "system"} onSelect={() => setTheme("system")}>
            System
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LogOut />} onSelect={() => logout()}>
            Sign out
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

/** Opens the task sheet on the current page via ?task=N. */
export function useOpenTask() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return React.useCallback(
    (number: number) => {
      const q = new URLSearchParams(sp.toString());
      q.set("task", String(number));
      router.push(`${path}?${q.toString()}`, { scroll: false });
    },
    [router, path, sp],
  );
}
