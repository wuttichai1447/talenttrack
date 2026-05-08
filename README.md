# TalentTrack — Mini Recruiting Pipeline Tool

A full-stack recruiting pipeline tool for HR teams that takes a candidate from
**Application → AI Resume Screening → Pipeline Tracking → Interview Scheduling →
Reporting** in one codebase.

Built as a 5-day take-home assignment.

---

## ✨ Modules

| # | Module | What it does |
|---|---|---|
| 1 | **AI Resume Screener** (`/screen`) | Upload a CV (PDF) or paste text, pick a JD, and let Claude score the candidate (Skills / Experience / Culture, 0-10) with reasoning, strengths, concerns, and tailored prescreen-call questions. Results can be saved into the pipeline in one click. |
| 2 | **Applicant Tracker** (`/candidates`) | Kanban + List views. Drag candidates between stages, filter by stage / position / source, and CRUD all candidate fields. |
| 3 | **Interview Scheduler** (`/interviews`) | Schedule prescreen calls and interviews with **conflict detection**, calendar view, **"Add to Google Calendar"** deep links (Google issues the real Meet link & emails the candidate), and downloadable `.ics` invites. Cancelling auto-records a stage event. |
| 4 | **Pipeline Dashboard & AI Report** (`/`) | Funnel, sources, score distribution, and an on-demand AI-written executive report ("what's the bottleneck, what should we do this week?"). |

---

## 🏗 Architecture decisions

### Tech stack
- **Next.js 15 (App Router) + TypeScript** — single codebase for FE + BE, easy Vercel deploy.
- **Prisma + SQLite** — file-based DB so the project boots with zero infrastructure. Swap `provider` to `postgresql` for production (one-line change). No app code changes required.
- **Tailwind CSS + shadcn/ui–style primitives + Radix UI** — accessible, fast, consistent.
- **@dnd-kit** for Kanban drag-and-drop (better A11y + perf than `react-beautiful-dnd`).
- **`pdfjs-dist` (legacy build)** for server-side PDF text extraction. Picked over `pdf-parse` because the latter ships test fixtures with very deep paths that hit Windows `MAX_PATH` limits.
- **`ics`** for downloadable calendar invites (Outlook / Apple Calendar).
- **Google Calendar deep link** (`calendar.google.com/calendar/render?...`) for one-click event creation in HR's own Google account — Google attaches the real Meet link automatically. No OAuth, no API keys, no Google Cloud project needed; see [Interview scheduling — Google Calendar integration](#interview-scheduling--google-calendar-integration) below for the rationale.
- **Anthropic Claude (`@anthropic-ai/sdk`)** with `claude-sonnet-4-6` for the two AI features.

### Data model (Prisma)

```
Job (1) ── (N) Candidate (1) ── (N) ResumeScreening
                       (1) ── (N) Interview
                       (1) ── (N) StageEvent     ← audit / time-in-stage
```

Key choices:
- **`StageEvent`** is its own table so we can compute *time in stage* and an audit trail without polling the candidate row.
- **Multiple `ResumeScreening`s per candidate** — HR can re-screen the same CV against a different JD (or rerun after an updated prompt).
- Stage IDs are **string enums** (declared in `src/lib/stages.ts`) for SQLite portability while still strict-typed in TS.
- Structured AI outputs (`strengths`, `concerns`, `prescreenQuestions`) are stored as JSON strings — SQLite-friendly and the small overhead of `JSON.parse` doesn't matter at HR scale.

### AI integration

Two distinct AI surfaces, both using **structured output via prompt** (not tool-use):

1. **Resume screening** (`src/lib/screen-resume.ts`)
   - System prompt forces JSON-only output and gives a strict rubric (0-3 / 4-6 / 7-8 / 9-10).
   - User prompt embeds JD + resume + the JSON schema.
   - Defensive `extractJSON()` strips fences and clamps scores to [0, 10].
   - Iterated 3 times — see `COWORK_LOG.md`.

2. **Pipeline AI report** (`src/lib/ai-report.ts`)
   - Sends a compact JSON snapshot of the dashboard stats (NOT the full DB) so prompts stay short and cheap.
   - Asks for a 1-line headline, 2-4 sentence summary, 3-5 numbered insights, and concrete recommendations with rationale.
   - Self-reports `confidence: low | medium | high` based on data volume.

### UX choices for HR users

- **Kanban as the primary view** — HR mental model is "where is this candidate now?", not a spreadsheet.
- **Score colour coding throughout** — green ≥ 7.5, amber 5-7.5, red < 5. Same threshold everywhere (Kanban card, list, detail, dashboard).
- **"Copy briefing" button** on every score card — HR's #1 daily task is sharing context with the hiring manager.
- **AI suggestion auto-fill** in the Schedule Interview dialog — pulls prescreen questions from the AI screening directly into the interview description so interviewers walk in prepared.
- **Conflict detection BEFORE save** — modal shows overlapping interviews and lets HR override only when intentional.
- **Empty states with next action** everywhere — never a dead end.

---

## 🚀 Setup

### Prerequisites
- Node.js 20+ (tested on 22)
- npm or pnpm

### Steps

```bash
# 1. Install dependencies
pnpm install
# or: npm install --legacy-peer-deps

# 2. Configure environment
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY (get one at https://console.anthropic.com/)

# 3. Set up the database (SQLite, file-based)
pnpm db:push
pnpm db:seed

# 4. Run dev server
pnpm dev
```

Open http://localhost:3000.

> **Note:** All AI features (`/screen` and the Dashboard AI Report) require `ANTHROPIC_API_KEY`. The rest of the app works fully without it — you can demo Modules 2 and 3 end-to-end with seed data alone.

### Database

Default = SQLite (`prisma/dev.db`). To switch to Postgres:

```diff
# prisma/schema.prisma
  datasource db {
-   provider = "sqlite"
+   provider = "postgresql"
    url      = env("DATABASE_URL")
  }
```

Then update `DATABASE_URL` in `.env` and run `pnpm db:push`.

---

## 📅 Interview scheduling — Google Calendar integration

The brief asks for "Google Meeting Calendar"-backed interviews. Three approaches were considered:

| Approach | Pros | Cons |
|---|---|---|
| **A. Google Calendar deep link (`calendar.google.com/calendar/render?...`)** ✅ chosen | No OAuth, no Google Cloud project, no env vars. HR's own calendar = correct ownership. Real Meet link auto-attached on Save. | One extra click in Google Calendar to confirm. |
| B. Calendar API + Service Account | Zero clicks; events appear automatically. | Requires Google Workspace + domain-wide delegation; events would be owned by a service account, not the HR. |
| C. Per-user OAuth (Calendar API) | Full automation under HR's account. | OAuth consent screen, redirect URIs, refresh-token storage, token rotation — heavy for a take-home. |

**How A works** (`buildGoogleCalendarUrl` in `src/lib/interview.ts`):
1. HR schedules in TalentTrack → row saved (with a placeholder reference id only).
2. HR clicks **"Add to Google Calendar"** → a `calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&add=...` URL opens in their account, prefilled with title, time, attendees, and description (auto-includes the AI-generated prescreen questions).
3. HR clicks Save → **Google Calendar attaches a real Meet link automatically** (Workspace default; one click for personal accounts) and emails the candidate the invite.

In addition, every interview row also exposes a `.ics` download endpoint (`/api/interviews/:id/ics`) for HR who use Outlook or Apple Calendar.

---

## 🗂 Project structure

```
src/
├─ app/
│  ├─ page.tsx                    Module 4 — Dashboard
│  ├─ ai-report-card.tsx          AI report client component
│  ├─ candidates/                 Module 2 — Applicant Tracker
│  │  ├─ page.tsx
│  │  ├─ candidates-view.tsx      Tabs (Kanban / List), filters, state
│  │  ├─ kanban-board.tsx         dnd-kit board
│  │  ├─ candidate-list.tsx
│  │  ├─ new-candidate-dialog.tsx
│  │  └─ [id]/
│  │     ├─ page.tsx              Detail view
│  │     └─ candidate-actions.tsx
│  ├─ screen/                     Module 1 — Resume Screener
│  │  ├─ page.tsx
│  │  ├─ screen-form.tsx
│  │  └─ score-card.tsx
│  ├─ interviews/                 Module 3 — Interview Scheduler
│  │  ├─ page.tsx
│  │  ├─ interviews-view.tsx
│  │  ├─ interview-list.tsx
│  │  ├─ schedule-dialog.tsx
│  │  └─ calendar-view.tsx        Month grid
│  └─ api/                        REST API routes
│     ├─ candidates/[id]/route.ts
│     ├─ candidates/route.ts
│     ├─ interviews/[id]/ics/route.ts
│     ├─ interviews/[id]/route.ts
│     ├─ interviews/route.ts
│     ├─ jobs/route.ts
│     ├─ report/route.ts          Module 4 AI report
│     └─ screen/route.ts          Module 1 screening
├─ components/
│  ├─ app-sidebar.tsx             Desktop nav
│  ├─ mobile-nav.tsx              Bottom nav (mobile)
│  ├─ page-header.tsx
│  └─ ui/                         shadcn-style primitives
└─ lib/
   ├─ ai-report.ts                Module 4 prompt
   ├─ anthropic.ts                Lazy Claude client + JSON extractor
   ├─ dashboard.ts                Pure stat-computation functions
   ├─ interview.ts                Google Calendar URL + conflict detection + .ics builder
   ├─ pdf.ts                      Server-side PDF parser
   ├─ prisma.ts
   ├─ screen-resume.ts            Module 1 prompt
   ├─ stages.ts                   Single source of truth for pipeline stages
   └─ utils.ts                    cn, formatDate, safeJSON, …
prisma/
├─ schema.prisma
└─ seed.ts
```

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start Next.js dev server (Turbopack) |
| `pnpm build` | `prisma generate` + production build |
| `pnpm start` | Start production server |
| `pnpm db:push` | Sync Prisma schema to the database |
| `pnpm db:seed` | Seed sample job + candidates |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm lint` | ESLint |

---

## 🤖 Cowork Log

See [COWORK_LOG.md](./COWORK_LOG.md) for the prompt iteration journey on the AI features.

---

## 🌐 Deployment

The app is Vercel-ready. Steps:

1. Push to GitHub.
2. Import on Vercel.
3. Set env vars: `DATABASE_URL` (use a hosted Postgres like Neon), `ANTHROPIC_API_KEY`.
4. Update `prisma/schema.prisma` `provider` → `postgresql`.
5. Vercel runs `prisma generate && next build` automatically (it's wired into the `build` script).

---

## 📝 What I'd do with another week

- Email the candidate the .ics + Meet link automatically (Resend / SES).
- Bulk CV upload — drag a folder, queue Claude calls with rate limiting + Bull/Inngest.
- Real Google Calendar API (OAuth or Service Account) for zero-click scheduling — currently we use a deep link that opens prefilled in HR's Google Calendar (one click to Save, one Meet link auto-issued by Google).
- "Compare candidates" view — side-by-side score cards.
- Multi-user with Auth.js + role-based access (Recruiter / Hiring Manager / Admin).
- E2E tests with Playwright.
