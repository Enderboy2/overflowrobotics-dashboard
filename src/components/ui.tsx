"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as RD from "@radix-ui/react-dialog";
import * as DM from "@radix-ui/react-dropdown-menu";
import * as PO from "@radix-ui/react-popover";
import { Check, ChevronDown, X } from "lucide-react";
import { cn, initials, personColor } from "@/lib/utils";
import type { Tone } from "@/lib/meta";
import type { TaskStatus } from "@/db/schema";

/* ───────── Buttons ───────── */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export const Button = React.forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", size = "md", className, ...p },
  ref,
) {
  return (
    <button
      ref={ref}
      {...p}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
        size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-[13px]",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover",
        variant === "secondary" && "border border-line bg-surface text-fg shadow-[0_1px_1px_rgb(0_0_0/0.03)] hover:bg-surface-2",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
        variant === "danger" && "border border-line bg-surface text-bad hover:bg-bad/10",
        className,
      )}
    />
  );
});

export const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconButton({ label, className, ...p }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        {...p}
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40 [&_svg]:size-4",
          className,
        )}
      />
    );
  },
);

/* ───────── Display ───────── */

const toneClass: Record<Tone, string> = {
  gray: "bg-surface-3 text-muted",
  blue: "bg-info/12 text-info",
  amber: "bg-warn/12 text-warn",
  green: "bg-ok/12 text-ok",
  red: "bg-bad/10 text-bad",
  violet: "bg-[#7c5cdb]/12 text-[#6e56cf] dark:text-[#b197fc]",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11.5px] font-medium", toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2 text-[11.5px] text-muted">
      {color && <span className="size-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  );
}

export function Avatar({ id, name, size = 20, className }: { id: string; name: string; size?: number; className?: string }) {
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface", className)}
      style={{ width: size, height: size, fontSize: size * 0.4, background: personColor(id) }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 3, size = 20 }: { people: { id: string; name: string }[]; max?: number; size?: number }) {
  if (!people.length) return null;
  return (
    <span className="flex items-center -space-x-1.5">
      {people.slice(0, max).map((p) => (
        <Avatar key={p.id} id={p.id} name={p.name} size={size} />
      ))}
      {people.length > max && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-surface-3 text-[10px] font-medium text-muted ring-2 ring-surface"
          style={{ width: size, height: size }}
        >
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

/** Linear-style status glyphs drawn in SVG. */
export function StatusIcon({ status, size = 14 }: { status: TaskStatus; size?: number }) {
  const c = {
    backlog: "var(--subtle)",
    todo: "var(--muted)",
    in_progress: "#d9a400",
    review: "#3e63dd",
    blocked: "var(--bad)",
    done: "#5e6ad2",
    cancelled: "var(--subtle)",
  }[status];
  const common = { width: size, height: size, viewBox: "0 0 14 14", fill: "none", className: "shrink-0" } as const;
  switch (status) {
    case "backlog":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" stroke={c} strokeWidth="1.5" strokeDasharray="2 2.1" />
        </svg>
      );
    case "todo":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" stroke={c} strokeWidth="1.5" />
        </svg>
      );
    case "in_progress":
    case "review": {
      const frac = status === "in_progress" ? 0.5 : 0.75;
      const a = frac * 2 * Math.PI;
      const x = 7 + 3 * Math.sin(a);
      const y = 7 - 3 * Math.cos(a);
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" stroke={c} strokeWidth="1.5" />
          <path d={`M7 7 L7 4 A3 3 0 ${frac > 0.5 ? 1 : 0} 1 ${x} ${y} Z`} fill={c} />
        </svg>
      );
    }
    case "blocked":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6.25" fill={c} />
          <path d="M4.5 7h5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "done":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6.25" fill={c} />
          <path d="M4.4 7.2 6.2 9l3.4-3.8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "cancelled":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6.25" fill={c} />
          <path d="m5 5 4 4m0-4-4 4" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
  }
}

export function PriorityIcon({ priority, size = 14 }: { priority: number; size?: number }) {
  if (priority === 1)
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
        <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--accent)" />
        <path d="M7 3.8v4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="7" cy="10.2" r="0.95" fill="white" />
      </svg>
    );
  if (priority === 0)
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
        {[2.5, 6, 9.5].map((x) => (
          <rect key={x} x={x} y="6.4" width="2" height="1.2" rx="0.6" fill="var(--subtle)" />
        ))}
      </svg>
    );
  const filled = { 2: 3, 3: 2, 4: 1 }[priority] ?? 0;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2 + i * 3.6} y={9 - i * 3} width="2.4" height={3 + i * 3} rx="0.8" fill={i < filled ? "var(--fg)" : "var(--line-strong)"} />
      ))}
    </svg>
  );
}

export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className="h-full rounded-full transition-[width]" style={{ width: `${v * 100}%`, background: color ?? "var(--fg)" }} />
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-surface px-1 font-sans text-[10.5px] text-muted">
      {children}
    </kbd>
  );
}

export function Card({ children, className, title, action }: { children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface", className)}>
      {title && (
        <header className="flex h-10 items-center justify-between gap-2 border-b border-line px-4">
          <h2 className="truncate text-[13px] font-medium">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "bad" | "ok" | "warn" }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className={cn("tabular mt-1 truncate text-xl font-semibold tracking-tight", tone === "bad" && "text-bad", tone === "ok" && "text-ok", tone === "warn" && "text-warn")}>
        {value}
      </div>
      {sub && <div className="mt-0.5 truncate text-xs text-subtle">{sub}</div>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-subtle [&_svg]:size-6">{icon}</div>}
      <div className="text-[13px] font-medium">{title}</div>
      {children && <div className="mt-1 max-w-sm text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, children, crumbs }: { title: React.ReactNode; children?: React.ReactNode; crumbs?: { label: string; href: string }[] }) {
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-1.5 pl-9 text-[13px] md:pl-0">
        {crumbs?.map((c) => (
          <React.Fragment key={c.href}>
            <Link href={c.href} className="truncate text-muted hover:text-fg">
              {c.label}
            </Link>
            <span className="text-subtle">/</span>
          </React.Fragment>
        ))}
        <h1 className="truncate font-medium">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </header>
  );
}

export function Tabs({ items }: { items: { href: string; label: string; count?: number; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line px-4 md:px-6">
      {items.map((t) => {
        const active = t.exact ? path === t.href : path === t.href || path.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative flex h-10 items-center gap-1.5 whitespace-nowrap px-2 text-[13px] transition-colors",
              active ? "font-medium text-fg after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className="tabular rounded bg-surface-3 px-1 text-[11px] text-muted">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/* ───────── Overlays ───────── */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="anim-fade fixed inset-0 z-50 bg-black/30 dark:bg-black/50" />
        <RD.Content
          className={cn(
            "anim-pop fixed left-1/2 top-[8vh] z-50 flex max-h-[84vh] w-[calc(100vw-24px)] -translate-x-1/2 flex-col rounded-xl border border-line bg-surface shadow-pop outline-none",
            wide ? "max-w-2xl" : "max-w-md",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4">
            <div>
              <RD.Title className="text-[15px] font-semibold">{title}</RD.Title>
              {description ? <RD.Description className="mt-0.5 text-[13px] text-muted">{description}</RD.Description> : <RD.Description className="sr-only">{title}</RD.Description>}
            </div>
            <RD.Close asChild>
              <IconButton label="Close">
                <X />
              </IconButton>
            </RD.Close>
          </div>
          <div className="min-h-0 overflow-y-auto px-5 py-2">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

export function Sheet({ open, onOpenChange, children, title }: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode; title: string }) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="anim-fade fixed inset-0 z-40 bg-black/20 dark:bg-black/40" />
        <RD.Content className="anim-slide fixed inset-y-0 right-0 z-40 flex w-full max-w-[860px] flex-col border-l border-line bg-surface shadow-pop outline-none">
          <RD.Title className="sr-only">{title}</RD.Title>
          <RD.Description className="sr-only">{title}</RD.Description>
          {children}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ children, align = "start", className }: { children: React.ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={4}
        collisionPadding={8}
        className={cn("anim-pop z-50 max-h-[min(380px,var(--radix-dropdown-menu-content-available-height))] min-w-[180px] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop", className)}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  checked,
  danger,
  icon,
  shortcut,
}: {
  children: React.ReactNode;
  onSelect?: (e: Event) => void;
  checked?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
  shortcut?: string;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className={cn(
        "flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] outline-none data-[highlighted]:bg-surface-2 [&_svg]:size-3.5",
        danger ? "text-bad" : "text-fg",
      )}
    >
      {icon && <span className="flex w-4 justify-center text-muted">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="text-xs text-subtle">{shortcut}</span>}
      {checked !== undefined && <Check className={cn("text-fg", !checked && "invisible")} />}
    </DM.Item>
  );
}

export const MenuSeparator = () => <DM.Separator className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => <DM.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-subtle">{children}</DM.Label>;

export const Popover = PO.Root;
export const PopoverTrigger = PO.Trigger;
export function PopoverContent({ children, align = "start", className }: { children: React.ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <PO.Portal>
      <PO.Content align={align} sideOffset={4} collisionPadding={8} className={cn("anim-pop z-50 rounded-lg border border-line bg-surface p-1 shadow-pop outline-none", className)}>
        {children}
      </PO.Content>
    </PO.Portal>
  );
}

/* ───────── Pickers ───────── */

type Opt<T> = { value: T; label: string; icon?: React.ReactNode; hint?: string };

/** Searchable single/multi select in a popover. */
export function Picker<T extends string | number>({
  options,
  value,
  onChange,
  multiple,
  trigger,
  placeholder = "Search…",
  align,
  disabled,
}: {
  options: Opt<T>[];
  value: T | T[] | null;
  onChange: (v: T | T[] | null) => void;
  multiple?: boolean;
  trigger: React.ReactNode;
  placeholder?: string;
  align?: "start" | "end";
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hi, setHi] = React.useState(0);
  const selected = new Set<T>(Array.isArray(value) ? value : value === null ? [] : [value]);
  const list = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const pick = (o: Opt<T>) => {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(o.value)) next.delete(o.value);
      else next.add(o.value);
      onChange([...next]);
    } else {
      onChange(o.value);
      setOpen(false);
    }
  };
  if (disabled) return <>{trigger}</>;
  return (
    <PO.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setQ("");
        setHi(0);
      }}
    >
      <PO.Trigger asChild>{trigger}</PO.Trigger>
      <PopoverContent align={align} className="w-60 p-0">
        {options.length > 6 && (
          <div className="border-b border-line p-1">
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") setHi((h) => Math.min(h + 1, list.length - 1));
                if (e.key === "ArrowUp") setHi((h) => Math.max(h - 1, 0));
                if (e.key === "Enter" && list[hi]) {
                  e.preventDefault();
                  pick(list[hi]);
                }
              }}
              placeholder={placeholder}
              className="h-8 w-full bg-transparent px-2 text-[13px] outline-none placeholder:text-subtle"
            />
          </div>
        )}
        <div className="max-h-72 overflow-y-auto p-1">
          {list.map((o, i) => (
            <button
              key={String(o.value)}
              type="button"
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(o)}
              className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]", i === hi && "bg-surface-2")}
            >
              {o.icon && <span className="flex w-4 justify-center">{o.icon}</span>}
              <span className="flex-1 truncate">{o.label}</span>
              {o.hint && <span className="text-xs text-subtle">{o.hint}</span>}
              <Check className={cn("size-3.5", !selected.has(o.value) && "invisible")} />
            </button>
          ))}
          {!list.length && <div className="px-2 py-3 text-center text-xs text-subtle">No matches</div>}
        </div>
      </PopoverContent>
    </PO.Root>
  );
}

/** A compact property trigger used in toolbars and detail sidebars. */
export const Chip = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; caret?: boolean }>(
  function Chip({ className, children, active, caret, ...p }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        {...p}
        className={cn(
          "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2 text-[12.5px] transition-colors disabled:cursor-default [&_svg]:size-3.5 [&_svg]:shrink-0",
          active ? "border-line-strong bg-surface-2 text-fg" : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-fg",
          className,
        )}
      >
        {children}
        {caret && <ChevronDown className="text-subtle" />}
      </button>
    );
  },
);

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cn("input appearance-none bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7", className)} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2398938f' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-[13px]">
      <span className={cn("relative block h-4 w-7 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform", checked ? "translate-x-3.5" : "translate-x-0.5")} />
      </span>
      {label}
    </button>
  );
}

/** Tiny toast system. */
type ToastT = { id: number; text: string; tone?: "error" | "ok" };
const ToastCtx = React.createContext<(text: string, tone?: ToastT["tone"]) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastT[]>([]);
  const push = React.useCallback((text: string, tone?: ToastT["tone"]) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "anim-pop pointer-events-auto max-w-sm rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] shadow-pop",
              t.tone === "error" && "border-bad/30 text-bad",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Runs a server action with pending state, error toast, and router refresh. */
export function useAction() {
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const run = React.useCallback(
    <R,>(fn: () => Promise<R>, opts: { success?: string; refresh?: boolean; then?: (r: R) => void } = {}) =>
      start(async () => {
        try {
          const r = await fn();
          if (r && typeof r === "object" && "error" in r && (r as { error?: string }).error) {
            toast((r as { error: string }).error, "error");
            return;
          }
          if (opts.success) toast(opts.success);
          opts.then?.(r);
          if (opts.refresh !== false) router.refresh();
        } catch (e) {
          toast(e instanceof Error ? e.message : "Something went wrong", "error");
        }
      }),
    [router, toast],
  );
  return { run, pending };
}
