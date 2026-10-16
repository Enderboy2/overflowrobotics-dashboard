import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  serial,
  numeric,
  date,
  jsonb,
  primaryKey,
  index,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType() {
    return "bytea";
  },
  fromDriver(v) {
    return Buffer.isBuffer(v) ? v : Buffer.from(v);
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

/* ───────────────────────── People ───────────────────────── */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  financeAccess: boolean("finance_access").notNull().default(false),
  title: text("title"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const subteams = pgTable("subteams", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  code: text("code").notNull().unique(), // short prefix for task ids, e.g. SW
  name: text("name").notNull(),
  color: text("color").notNull(),
  description: text("description"),
  sort: integer("sort").notNull().default(0),
});

export type SubteamRole = "head" | "cohead" | "member";

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subteamId: uuid("subteam_id")
      .notNull()
      .references(() => subteams.id, { onDelete: "cascade" }),
    role: text("role").$type<SubteamRole>().notNull().default("member"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.subteamId] })],
);

/* ───────────────────────── Work ───────────────────────── */

export type ProjectStatus = "planned" | "active" | "on_hold" | "done";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").$type<ProjectStatus>().notNull().default("active"),
  subteamId: uuid("subteam_id").references(() => subteams.id, { onDelete: "set null" }),
  leadId: uuid("lead_id").references(() => users.id, { onDelete: "set null" }),
  startDate: date("start_date"),
  targetDate: date("target_date"),
  budget: money("budget"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "blocked" | "done" | "cancelled";
export type TaskPriority = 0 | 1 | 2 | 3 | 4; // 0 none, 1 urgent, 2 high, 3 medium, 4 low

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    priority: integer("priority").$type<TaskPriority>().notNull().default(0),
    subteamId: uuid("subteam_id")
      .notNull()
      .references(() => subteams.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    parentId: uuid("parent_id"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    estimateHours: numeric("estimate_hours", { precision: 6, scale: 2, mode: "number" }),
    labels: text("labels").array().notNull().default([]),
    sortOrder: numeric("sort_order", { mode: "number" }).notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("tasks_subteam_idx").on(t.subteamId), index("tasks_parent_idx").on(t.parentId)],
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] })],
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    blockedById: uuid("blocked_by_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.blockedById] })],
);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const timeEntries = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  minutes: integer("minutes").notNull(),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const timers = pgTable("timers", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  startedAt: ts("started_at").notNull().defaultNow(),
});

export type EventType = "meeting" | "competition" | "deadline" | "workshop" | "testing" | "other";

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").$type<EventType>().notNull().default("meeting"),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at"),
  allDay: boolean("all_day").notNull().default(false),
  location: text("location"),
  subteamId: uuid("subteam_id").references(() => subteams.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ───────────────────────── Files ───────────────────────── */

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ───────────────────────── Finance ───────────────────────── */

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  season: text("season").notNull(),
  subteamId: uuid("subteam_id").references(() => subteams.id, { onDelete: "cascade" }), // null = team-wide / general
  amount: money("amount").notNull(),
  notes: text("notes"),
});

export type SponsorStatus = "prospect" | "contacted" | "negotiating" | "committed" | "active" | "declined";

export const sponsors = pgTable("sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: text("tier"),
  status: text("status").$type<SponsorStatus>().notNull().default("prospect"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  pledged: money("pledged").notNull().default(0),
  inKind: text("in_kind"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  nextFollowUp: date("next_follow_up"),
  notes: text("notes"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type RequestStatus = "pending" | "head_approved" | "approved" | "ordered" | "received" | "rejected" | "cancelled";
export type RequestItem = { name: string; qty: number; unitPrice: number; link?: string };

export const purchaseRequests = pgTable("purchase_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: serial("number").notNull().unique(),
  title: text("title").notNull(),
  justification: text("justification"),
  items: jsonb("items").$type<RequestItem[]>().notNull().default([]),
  total: money("total").notNull().default(0),
  vendor: text("vendor"),
  neededBy: date("needed_by"),
  urgent: boolean("urgent").notNull().default(false),
  status: text("status").$type<RequestStatus>().notNull().default("pending"),
  subteamId: uuid("subteam_id")
    .notNull()
    .references(() => subteams.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
  headApprovedBy: uuid("head_approved_by").references(() => users.id, { onDelete: "set null" }),
  headApprovedAt: ts("head_approved_at"),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: ts("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type TxType = "income" | "expense";
export type ReimburseStatus = "none" | "pending" | "reimbursed";

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").$type<TxType>().notNull(),
    amount: money("amount").notNull(),
    date: date("date").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    vendor: text("vendor"),
    method: text("method"), // cash, bank transfer, card, instapay...
    subteamId: uuid("subteam_id").references(() => subteams.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, { onDelete: "set null" }),
    requestId: uuid("request_id").references(() => purchaseRequests.id, { onDelete: "set null" }),
    paidBy: uuid("paid_by").references(() => users.id, { onDelete: "set null" }),
    reimbursement: text("reimbursement").$type<ReimburseStatus>().notNull().default("none"),
    receiptId: uuid("receipt_id").references(() => files.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("tx_date_idx").on(t.date)],
);

/* ───────────────────────── Inventory ───────────────────────── */

export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  partNumber: text("part_number"),
  category: text("category"),
  subteamId: uuid("subteam_id").references(() => subteams.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").notNull().default(0),
  unit: text("unit"),
  location: text("location"),
  unitCost: money("unit_cost"),
  requestId: uuid("request_id").references(() => purchaseRequests.id, { onDelete: "set null" }),
  notes: text("notes"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ───────────────────────── System ───────────────────────── */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notif_user_idx").on(t.userId)],
);

export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    entity: text("entity").notNull(), // task, request, transaction, ...
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("activity_entity_idx").on(t.entityId)],
);

export type ViewConfig = {
  layout: "list" | "board" | "calendar" | "timeline";
  groupBy: string;
  sort: string;
  filters: Record<string, string[] | string | boolean>;
};

export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  config: jsonb("config").$type<ViewConfig>().notNull(),
  shared: boolean("shared").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
});
