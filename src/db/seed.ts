import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import type { DB } from "./index";
import * as s from "./schema";

export const DEFAULT_SETTINGS = {
  teamName: "Overflow Robotics",
  currency: "EGP",
  season: "2026–27",
  seasonStart: "2026-08-01",
  expenseCategories: [
    "Electronics",
    "Mechanical parts",
    "Raw materials",
    "Manufacturing",
    "Tools & equipment",
    "Software & subscriptions",
    "Competition fees",
    "Travel",
    "Shipping & customs",
    "Marketing & media",
    "Food & logistics",
    "Other",
  ],
  incomeCategories: ["Sponsorship", "Donation", "Member contributions", "Prize money", "Education (TIS)", "Other"],
  labels: ["CAD", "Firmware", "PCB", "Testing", "Documentation", "Pool test", "Design review", "Outreach", "Video", "Purchase"],
};

const SUBTEAMS = [
  { slug: "software", code: "SW", name: "Software", color: "#3E63DD", sort: 1, description: "Control software, GUI, vision and autonomy." },
  { slug: "hardware", code: "HW", name: "Hardware", color: "#C2780A", sort: 2, description: "Frame, mechanisms, tooling, buoyancy and manufacturing." },
  { slug: "electrical", code: "EL", name: "Electrical", color: "#7C5CDB", sort: 3, description: "Power, PCBs, tether, sensors and wiring." },
  { slug: "media", code: "MD", name: "Media", color: "#12A594", sort: 4, description: "Branding, video, social media, documentation design and sponsorship outreach." },
];

export async function seed(db: DB, opts: { demo?: boolean; adminEmail?: string; adminPassword?: string; adminName?: string } = {}) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(s.settings).values({ key, value }).onConflictDoNothing();
  }

  const existing = await db.select().from(s.subteams);
  if (existing.length === 0) await db.insert(s.subteams).values(SUBTEAMS);

  const email = (opts.adminEmail ?? process.env.ADMIN_EMAIL ?? (opts.demo ? "admin@overflowrobotics.com" : ""))
    .trim()
    .toLowerCase();
  const password = opts.adminPassword ?? process.env.ADMIN_PASSWORD ?? (opts.demo ? "overflow-dev" : "");
  if (email && password) {
    const [found] = await db.select().from(s.users).where(eq(s.users.email, email));
    if (!found) {
      await db.insert(s.users).values({
        name: opts.adminName ?? process.env.ADMIN_NAME ?? "Team Admin",
        email,
        passwordHash: await bcrypt.hash(password, 10),
        isAdmin: true,
        financeAccess: true,
        title: "Team Leader",
      });
    }
  }

  if (opts.demo) await seedDemo(db);
}

/* Demo data — only used for local development (no DATABASE_URL). */
async function seedDemo(db: DB) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.tasks);
  if (count > 0) return;

  const teams = Object.fromEntries((await db.select().from(s.subteams)).map((t) => [t.slug, t]));
  const hash = await bcrypt.hash("member-dev", 10);

  const people: [string, string, keyof typeof teams, s.SubteamRole, string?][] = [
    ["Omar Hassan", "omar", "software", "head", "Software Head"],
    ["Nour Adel", "nour", "software", "cohead", "Co-head, Vision"],
    ["Karim Sherif", "karim", "software", "member", "GUI"],
    ["Laila Mostafa", "laila", "software", "member", "Firmware"],
    ["Youssef Tarek", "youssef", "hardware", "head", "Hardware Head"],
    ["Mariam Fawzy", "mariam", "hardware", "cohead", "Co-head, Mechanisms"],
    ["Ahmed Samir", "ahmed", "hardware", "member", "CAD"],
    ["Hana Ibrahim", "hana", "hardware", "member", "Manufacturing"],
    ["Ziad Khaled", "ziad", "electrical", "head", "Electrical Head"],
    ["Salma Ashraf", "salma", "electrical", "cohead", "Co-head, Power"],
    ["Mostafa Wael", "mostafa", "electrical", "member", "PCB design"],
    ["Farida Nabil", "farida", "media", "head", "Media Head"],
    ["Jana Hesham", "jana", "media", "cohead", "Co-head, Video"],
    ["Ali Magdy", "ali", "media", "member", "Social media"],
  ];
  const userIds: Record<string, string> = {};
  for (const [name, handle, team, role, title] of people) {
    const [u] = await db
      .insert(s.users)
      .values({ name, email: `${handle}@overflowrobotics.com`, passwordHash: hash, title, financeAccess: handle === "farida" })
      .returning();
    userIds[handle] = u.id;
    await db.insert(s.memberships).values({ userId: u.id, subteamId: teams[team].id, role });
  }
  const [admin] = await db.select().from(s.users).where(eq(s.users.isAdmin, true));

  const d = (offset: number) => {
    const x = new Date();
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };

  const [rov] = await db
    .insert(s.projects)
    .values({ name: "ROV 2027 frame & propulsion", status: "active", subteamId: teams.hardware.id, leadId: userIds.youssef, startDate: d(-30), targetDate: d(60), budget: 85000, description: "New frame, thruster layout and buoyancy for the 2027 MATE season." })
    .returning();
  const [ctrl] = await db
    .insert(s.projects)
    .values({ name: "Control station v3", status: "active", subteamId: teams.software.id, leadId: userIds.omar, startDate: d(-20), targetDate: d(45), budget: 12000, description: "Pilot GUI rewrite, camera pipeline, and telemetry." })
    .returning();
  const [power] = await db
    .insert(s.projects)
    .values({ name: "Tether & power distribution", status: "active", subteamId: teams.electrical.id, leadId: userIds.ziad, startDate: d(-25), targetDate: d(40), budget: 40000 })
    .returning();
  const [docs] = await db
    .insert(s.projects)
    .values({ name: "Technical documentation 2027", status: "planned", leadId: userIds.farida, startDate: d(10), targetDate: d(120), description: "Tech doc, poster, and engineering presentation — all subteams contribute." })
    .returning();

  type T = [string, keyof typeof teams, s.TaskStatus, s.TaskPriority, number | null, string[], string | null, string[]];
  const taskRows: T[] = [
    ["Finalize frame CAD in SolidWorks", "hardware", "in_progress", 1, 5, ["ahmed", "youssef"], rov.id, ["CAD"]],
    ["Thruster mount stress analysis", "hardware", "todo", 2, 12, ["mariam"], rov.id, ["CAD", "Design review"]],
    ["Cut HDPE side plates", "hardware", "backlog", 3, 25, ["hana"], rov.id, []],
    ["Buoyancy foam calculation", "hardware", "review", 2, 2, ["mariam", "ahmed"], rov.id, ["Testing"]],
    ["Gripper prototype v2", "hardware", "blocked", 2, 8, ["hana"], rov.id, ["Pool test"]],
    ["Order aluminum extrusions", "hardware", "done", 3, -4, ["youssef"], rov.id, ["Purchase"]],
    ["Rewrite pilot GUI in Qt", "software", "in_progress", 2, 14, ["karim", "omar"], ctrl.id, []],
    ["Camera stream latency under 120ms", "software", "todo", 1, 6, ["nour"], ctrl.id, ["Testing"]],
    ["Thruster mixing matrix", "software", "review", 2, 1, ["laila"], ctrl.id, ["Firmware"]],
    ["Depth hold PID tuning", "software", "backlog", 3, 30, ["laila", "nour"], ctrl.id, ["Pool test"]],
    ["Photogrammetry task pipeline", "software", "todo", 3, 40, ["nour"], null, []],
    ["Set up CI for control code", "software", "done", 4, -10, ["omar"], ctrl.id, []],
    ["Power board schematic review", "electrical", "in_progress", 1, 3, ["mostafa", "salma"], power.id, ["PCB", "Design review"]],
    ["Tether strain relief", "electrical", "todo", 2, 9, ["ziad"], power.id, []],
    ["48V to 12V converter thermal test", "electrical", "blocked", 1, -1, ["salma"], power.id, ["Testing"]],
    ["Fuse calculation sheet", "electrical", "done", 3, -6, ["mostafa"], power.id, ["Documentation"]],
    ["SID diagram", "electrical", "backlog", 3, 50, ["ziad"], docs.id, ["Documentation"]],
    ["Season kickoff video", "media", "in_progress", 2, 4, ["jana", "ali"], null, ["Video"]],
    ["Sponsor deck 2027", "media", "review", 1, 2, ["farida"], null, ["Outreach"]],
    ["Instagram weekly posts plan", "media", "todo", 3, 7, ["ali"], null, []],
    ["Poster layout draft", "media", "backlog", 3, 70, ["jana"], docs.id, ["Documentation"]],
    ["Team photoshoot", "media", "done", 4, -12, ["farida", "jana"], null, []],
  ];
  const taskIds: string[] = [];
  let sort = 1;
  for (const [title, team, status, priority, due, assignees, projectId, labels] of taskRows) {
    const [t] = await db
      .insert(s.tasks)
      .values({
        title,
        subteamId: teams[team].id,
        status,
        priority,
        dueDate: due === null ? null : d(due),
        startDate: due === null ? null : d(due - 7),
        projectId,
        labels,
        estimateHours: [2, 4, 6, 8, 12][sort % 5],
        sortOrder: sort++,
        createdBy: admin.id,
        completedAt: status === "done" ? new Date() : null,
        description: "",
      })
      .returning();
    taskIds.push(t.id);
    for (const a of assignees) await db.insert(s.taskAssignees).values({ taskId: t.id, userId: userIds[a] });
    if (assignees[0])
      await db.insert(s.timeEntries).values({ taskId: t.id, userId: userIds[assignees[0]], minutes: 30 + (sort % 4) * 45, date: d(-(sort % 6)) });
  }
  await db.insert(s.taskDependencies).values({ taskId: taskIds[1], blockedById: taskIds[0] });
  await db.insert(s.taskDependencies).values({ taskId: taskIds[2], blockedById: taskIds[0] });
  await db.insert(s.tasks).values({ title: "Export STEP files for manufacturing", subteamId: teams.hardware.id, status: "todo", priority: 3, parentId: taskIds[0], dueDate: d(6), createdBy: admin.id, sortOrder: 99 });
  await db.insert(s.comments).values({ taskId: taskIds[0], userId: userIds.youssef, body: "Keep the frame under 11 kg dry — we need margin for the gripper." });

  const now = new Date();
  const at = (days: number, hour: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() + days);
    x.setHours(hour, 0, 0, 0);
    return x;
  };
  await db.insert(s.events).values([
    { title: "General meeting", type: "meeting", startsAt: at(2, 18), endsAt: at(2, 20), location: "Lab" },
    { title: "Pool test #1", type: "testing", startsAt: at(9, 10), endsAt: at(9, 14), location: "Club pool" },
    { title: "Hardware design review", type: "meeting", startsAt: at(5, 17), endsAt: at(5, 18), subteamId: teams.hardware.id },
    { title: "MATE regional registration closes", type: "deadline", startsAt: at(21, 0), allDay: true },
    { title: "MATE Egypt Regional", type: "competition", startsAt: at(150, 9), allDay: true, location: "Alexandria" },
  ]);

  await db.insert(s.budgets).values([
    { season: DEFAULT_SETTINGS.season, subteamId: teams.hardware.id, amount: 120000 },
    { season: DEFAULT_SETTINGS.season, subteamId: teams.electrical.id, amount: 80000 },
    { season: DEFAULT_SETTINGS.season, subteamId: teams.software.id, amount: 25000 },
    { season: DEFAULT_SETTINGS.season, subteamId: teams.media.id, amount: 15000 },
    { season: DEFAULT_SETTINGS.season, subteamId: null, amount: 160000, notes: "Travel, competition fees, general" },
  ]);

  const [sp1] = await db
    .insert(s.sponsors)
    .values([
      { name: "Delta Marine Services", tier: "Gold", status: "active", pledged: 150000, ownerId: userIds.farida, contactName: "Eng. Tamer" },
      { name: "Nile Electronics", tier: "Silver", status: "committed", pledged: 60000, inKind: "Connectors and cable", ownerId: userIds.farida, nextFollowUp: d(3) },
      { name: "Alex Fabrication Co.", tier: "In-kind", status: "negotiating", pledged: 0, inKind: "CNC machining hours", ownerId: userIds.jana, nextFollowUp: d(-1) },
      { name: "Blue Harbor Logistics", status: "contacted", pledged: 0, ownerId: userIds.ali, nextFollowUp: d(6) },
    ])
    .returning();

  const [pr1] = await db
    .insert(s.purchaseRequests)
    .values({
      title: "Blue Robotics T200 thrusters",
      justification: "Two spares after last season's failures.",
      items: [{ name: "T200 thruster", qty: 2, unitPrice: 11500, link: "https://bluerobotics.com" }],
      total: 23000,
      vendor: "Blue Robotics",
      subteamId: teams.hardware.id,
      projectId: rov.id,
      requestedBy: userIds.mariam,
      status: "head_approved",
      headApprovedBy: userIds.youssef,
      headApprovedAt: new Date(),
      neededBy: d(14),
    })
    .returning();
  await db.insert(s.purchaseRequests).values([
    {
      title: "Buck converters for power board",
      items: [{ name: "DC-DC 48V→12V 25A", qty: 3, unitPrice: 2400 }],
      total: 7200,
      vendor: "Local supplier",
      subteamId: teams.electrical.id,
      projectId: power.id,
      taskId: taskIds[14],
      requestedBy: userIds.salma,
      status: "pending",
      urgent: true,
      neededBy: d(4),
    },
    {
      title: "Camera module for vision",
      items: [{ name: "USB low-light camera", qty: 1, unitPrice: 3800 }],
      total: 3800,
      subteamId: teams.software.id,
      requestedBy: userIds.nour,
      status: "approved",
      approvedBy: admin.id,
      approvedAt: new Date(),
    },
  ]);

  const tx = (o: Partial<typeof s.transactions.$inferInsert> & Pick<typeof s.transactions.$inferInsert, "type" | "amount" | "description" | "category">) =>
    ({ date: d(-Math.floor(Math.random() * 60)), createdBy: admin.id, ...o }) as typeof s.transactions.$inferInsert;
  await db.insert(s.transactions).values([
    tx({ type: "income", amount: 100000, description: "Delta Marine — first installment", category: "Sponsorship", sponsorId: sp1.id, date: d(-50) }),
    tx({ type: "income", amount: 18000, description: "Member contributions — term 1", category: "Member contributions", date: d(-40) }),
    tx({ type: "income", amount: 22000, description: "TIS workshop revenue", category: "Education (TIS)", date: d(-15) }),
    tx({ type: "expense", amount: 14500, description: "Aluminum extrusions 20x20", category: "Raw materials", subteamId: teams.hardware.id, projectId: rov.id, taskId: taskIds[5], vendor: "Misr Aluminium", date: d(-12) }),
    tx({ type: "expense", amount: 9800, description: "HDPE sheets", category: "Raw materials", subteamId: teams.hardware.id, projectId: rov.id, date: d(-20) }),
    tx({ type: "expense", amount: 6300, description: "PCB fabrication — power board rev A", category: "Electronics", subteamId: teams.electrical.id, projectId: power.id, vendor: "JLCPCB", date: d(-18), paidBy: userIds.ziad, reimbursement: "pending" }),
    tx({ type: "expense", amount: 4200, description: "Tether cable 30m", category: "Electronics", subteamId: teams.electrical.id, projectId: power.id, date: d(-33) }),
    tx({ type: "expense", amount: 1450, description: "Adobe CC — 1 month", category: "Software & subscriptions", subteamId: teams.media.id, date: d(-8), paidBy: userIds.farida, reimbursement: "reimbursed" }),
    tx({ type: "expense", amount: 2600, description: "Raspberry Pi 5", category: "Electronics", subteamId: teams.software.id, projectId: ctrl.id, date: d(-26) }),
    tx({ type: "expense", amount: 3100, description: "Pool rental — test day", category: "Food & logistics", date: d(-5) }),
  ]);

  await db.insert(s.inventory).values([
    { name: "T200 thruster", partNumber: "BR-100583", category: "Propulsion", subteamId: teams.hardware.id, quantity: 6, minQuantity: 8, unit: "pcs", location: "Shelf A2", unitCost: 11500, requestId: pr1.id },
    { name: "M3x10 hex screws", category: "Fasteners", subteamId: teams.hardware.id, quantity: 340, minQuantity: 100, unit: "pcs", location: "Drawer F1" },
    { name: "XT60 connectors", category: "Connectors", subteamId: teams.electrical.id, quantity: 12, minQuantity: 20, unit: "pairs", location: "Box E3" },
    { name: "Raspberry Pi 5 8GB", category: "Compute", subteamId: teams.software.id, quantity: 2, minQuantity: 1, unit: "pcs", location: "Cabinet S1" },
    { name: "Sony A7 III", category: "Camera gear", subteamId: teams.media.id, quantity: 1, minQuantity: 1, unit: "pcs", location: "Media locker" },
  ]);
}
