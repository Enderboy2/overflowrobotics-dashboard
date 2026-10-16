"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Inbox, CheckCheck } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Avatar, Button, Empty, useAction } from "@/components/ui";
import { markRead } from "@/lib/actions/misc";
import { ago, cn } from "@/lib/utils";

type N = { id: string; actorId: string | null; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };

export function InboxList({ items }: { items: N[] }) {
  const { person } = useApp();
  const { run, pending } = useAction();
  const router = useRouter();
  const [tab, setTab] = React.useState<"unread" | "all">("unread");
  const unread = items.filter((n) => !n.readAt);
  const list = tab === "unread" ? unread : items;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 md:px-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex rounded-md border border-line bg-surface p-0.5">
          {(["unread", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("h-6 rounded px-2.5 text-[12.5px] capitalize", tab === t ? "bg-surface-3 font-medium" : "text-muted hover:text-fg")}>
              {t} {t === "unread" && unread.length > 0 && <span className="ml-0.5 text-subtle">{unread.length}</span>}
            </button>
          ))}
        </div>
        {unread.length > 0 && (
          <Button size="sm" variant="ghost" className="ml-auto" disabled={pending} onClick={() => run(() => markRead())}>
            <CheckCheck />
            Mark all as read
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <Empty icon={<Inbox />} title={tab === "unread" ? "You're all caught up" : "No notifications yet"}>
          Assignments, comments, mentions and purchase approvals show up here.
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {list.map((n) => {
            const p = person(n.actorId);
            return (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.readAt) run(() => markRead(n.id), { refresh: false });
                  if (n.href) router.push(n.href);
                }}
                className="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface-2/60"
              >
                {p ? <Avatar id={p.id} name={p.name} size={24} /> : <span className="size-6 rounded-full bg-surface-3" />}
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px]", !n.readAt ? "font-medium" : "text-muted")}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                </span>
                <span className="shrink-0 text-[11px] text-subtle">{ago(n.createdAt)}</span>
                {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
