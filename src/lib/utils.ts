import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO, differenceInCalendarDays } from "date-fns";

export const cn = (...v: ClassValue[]) => clsx(v);

export function money(n: number | null | undefined, currency = "EGP", opts: { compact?: boolean; sign?: boolean } = {}) {
  const v = Number(n ?? 0);
  const s = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: opts.compact && Math.abs(v) >= 10000 ? 1 : Number.isInteger(v) ? 0 : 2,
    notation: opts.compact && Math.abs(v) >= 10000 ? "compact" : "standard",
  }).format(Math.abs(v));
  const sign = v < 0 ? "−" : opts.sign && v > 0 ? "+" : "";
  return `${sign}${s} ${currency}`;
}

export const toDate = (d: string | Date) => (typeof d === "string" ? parseISO(d) : d);
export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export function shortDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const x = toDate(d);
  if (isToday(x)) return "Today";
  if (isTomorrow(x)) return "Tomorrow";
  if (isYesterday(x)) return "Yesterday";
  return format(x, x.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy");
}
export const longDate = (d: string | Date | null | undefined) => (d ? format(toDate(d), "EEE, MMM d, yyyy") : "");
export const dateTime = (d: string | Date) => format(toDate(d), "MMM d, HH:mm");
export const ago = (d: string | Date) => formatDistanceToNowStrict(toDate(d), { addSuffix: true });
export const daysUntil = (d: string) => differenceInCalendarDays(parseISO(d), new Date());

export function hours(minutes: number) {
  if (!minutes) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** Stable muted color per person, for avatars. */
export function personColor(id: string) {
  const palette = ["#3E63DD", "#C2780A", "#7C5CDB", "#12A594", "#D6409F", "#0D74CE", "#8E4EC6", "#5C7C2F", "#CA5A2B", "#4F6A8A"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function csv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c === null || c === undefined ? "" : String(c);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}
