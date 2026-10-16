import type { TaskStatus, TaskPriority, EventType, RequestStatus, SponsorStatus, ProjectStatus } from "@/db/schema";

export const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "review", label: "In review" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
  { id: "cancelled", label: "Cancelled" },
];
export const statusLabel = (s: TaskStatus) => STATUSES.find((x) => x.id === s)?.label ?? s;
export const OPEN_STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "review", "blocked"];
export const isClosed = (s: TaskStatus) => s === "done" || s === "cancelled";

export const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: 1, label: "Urgent" },
  { id: 2, label: "High" },
  { id: 3, label: "Medium" },
  { id: 4, label: "Low" },
  { id: 0, label: "No priority" },
];
export const priorityLabel = (p: number) => PRIORITIES.find((x) => x.id === p)?.label ?? "No priority";

export const EVENT_TYPES: { id: EventType; label: string; color: string }[] = [
  { id: "meeting", label: "Meeting", color: "#6B6966" },
  { id: "testing", label: "Testing", color: "#3E63DD" },
  { id: "workshop", label: "Workshop", color: "#12A594" },
  { id: "deadline", label: "Deadline", color: "#D62E14" },
  { id: "competition", label: "Competition", color: "#C2780A" },
  { id: "other", label: "Other", color: "#8D8A86" },
];

export const PROJECT_STATUSES: { id: ProjectStatus; label: string }[] = [
  { id: "planned", label: "Planned" },
  { id: "active", label: "Active" },
  { id: "on_hold", label: "On hold" },
  { id: "done", label: "Completed" },
];

export const REQUEST_STATUSES: { id: RequestStatus; label: string; tone: Tone }[] = [
  { id: "pending", label: "Awaiting head", tone: "amber" },
  { id: "head_approved", label: "Awaiting finance", tone: "amber" },
  { id: "approved", label: "Approved", tone: "blue" },
  { id: "ordered", label: "Ordered", tone: "violet" },
  { id: "received", label: "Received", tone: "green" },
  { id: "rejected", label: "Rejected", tone: "red" },
  { id: "cancelled", label: "Cancelled", tone: "gray" },
];

export const SPONSOR_STATUSES: { id: SponsorStatus; label: string; tone: Tone }[] = [
  { id: "prospect", label: "Prospect", tone: "gray" },
  { id: "contacted", label: "Contacted", tone: "blue" },
  { id: "negotiating", label: "Negotiating", tone: "amber" },
  { id: "committed", label: "Committed", tone: "violet" },
  { id: "active", label: "Active", tone: "green" },
  { id: "declined", label: "Declined", tone: "red" },
];

export type Tone = "gray" | "blue" | "amber" | "green" | "red" | "violet";

export const ROLE_LABEL = { head: "Head", cohead: "Co-head", member: "Member" } as const;
