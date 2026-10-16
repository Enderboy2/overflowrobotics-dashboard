# Overflow Dashboard

Internal dashboard for Overflow Robotics: tasks, projects, calendar, people, finance, and inventory, all in one place. It lives at `dashboard.overflowrobotics.com`.

## What's inside

| Area | What it does |
|---|---|
| **Home** | Your focus list, due-soon and overdue tasks, hours logged, approvals waiting on you, upcoming events, team pulse (for leads), and finance snapshot (for finance). |
| **Tasks** | List, Board (drag and drop), Calendar and Timeline (Gantt) views. Filters for status, priority, assignee, subteam, project, label and due date. Group by, sort, saved views (personal or team-wide), shareable URLs, bulk edit, and CSV export. |
| **Task detail** | Subtasks, dependencies ("blocked by"), attachments, comments with @mentions, a full activity history, time tracking (timer or manual), estimate vs. logged, and linked purchase requests and expenses. |
| **Projects** | Progress, overdue count, time, budget vs. spent, linked events and activity. |
| **Subteams** | Per-subteam stats, member workload, budget meter, events, and a task board. |
| **Calendar** | Meetings, pool tests, deadlines and competitions, with task due dates overlaid. |
| **People** | Directory with workload; profile pages with a time-logged heatmap. |
| **Finance** | Cash flow, budget vs. spent per subteam, spending by category, and a full ledger with receipts and CSV export. Purchase requests go through head approval, then finance approval, then ordered (which books the expense), then received (which can add the items to inventory). Also reimbursements (who is owed money), season budgets, and a sponsor pipeline. |
| **Inventory** | Parts and tools with low-stock alerts and quick +/- buttons. Received purchases flow in automatically. |
| **Inbox** | Notifications for assignments, status changes, comments, mentions and approvals. |
| **Admin** | Create accounts, set subteam roles, give finance or admin access, reset passwords, deactivate members, edit subteams, change settings (currency, season, categories, labels), and view the audit log. |

Press `⌘K` / `Ctrl+K` anywhere to search or jump. Press `C` to create a task (heads only).

## Roles

- **Member** sees all tasks and edits the status of tasks assigned to them. They can comment, log time, attach files, request purchases for their own subteam, and see their own reimbursements.
- **Co-head / Head** (per subteam) can create, edit, assign and delete their subteam's tasks. They also approve purchase requests at the first step, record their subteam's expenses, see their subteam's budget, and manage inventory and events. Media leads can also manage sponsors.
- **Finance access** (a per-person toggle) sees all money, gives final approval on purchases, records income, settles reimbursements, and sets budgets.
- **Admin** can do everything, including the Admin page.

## Deploy (about 15 minutes)

1. **Push this folder to a private GitHub repo**, for example `Enderboy2/overflow-dashboard`.
2. **Create the Vercel project.** Go to [vercel.com](https://vercel.com) → *Add New → Project* → import the repo. Don't deploy yet.
3. **Add a database.** In the project → *Storage* → *Create Database* → **Neon** (free tier) → connect it to the project. This sets `DATABASE_URL` for you.
4. **Add environment variables** (*Settings → Environment Variables*):
   - `ADMIN_EMAIL`: your email
   - `ADMIN_NAME`: your name
   - `ADMIN_PASSWORD`: a strong password you'll use for the first login
5. **Deploy.** The build runs the database migrations, creates the four subteams, and creates your admin account.
6. **Connect the subdomain.** In Vercel go to *Settings → Domains* → add `dashboard.overflowrobotics.com`. Vercel shows a **CNAME** record. Add it wherever `overflowrobotics.com`'s DNS is managed (if it's Netlify DNS: *Domains → overflowrobotics.com → DNS settings → Add new record*):
   - Type `CNAME`, name `dashboard`, value: the target Vercel shows you (usually `cname.vercel-dns.com`)
   - HTTPS is issued automatically within a few minutes.
7. **Sign in**, then open **Admin → Add member** for each person. Each new account gets a temporary password and a ready-to-paste message to send them. They choose their own password on first login.

After the first deploy you can delete `ADMIN_PASSWORD` from Vercel. The admin is only created when it doesn't already exist.

## Local development

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, the app runs on an embedded in-memory Postgres (PGlite) seeded with demo data. The data resets when the server restarts.

Demo logins (local only): `admin@overflowrobotics.com` / `overflow-dev`. Members such as `omar@overflowrobotics.com` (Software head) or `karim@overflowrobotics.com` (member) use `member-dev`.

To work against the real database, put `DATABASE_URL` in `.env.local`.

## Changing the schema

Edit `src/db/schema.ts`, then run `npm run db:generate` and commit the new file in `drizzle/`. The next deploy applies it automatically.

## Stack

Next.js 15 (App Router, server actions), Postgres with Drizzle ORM, Tailwind CSS v4, Radix primitives, and lucide icons. Sessions are httpOnly cookies backed by the database, and passwords are hashed with bcrypt. Files and receipts (up to 5 MB) are stored in Postgres, so there is no extra storage service to set up.
