# Cowork Log — TalentTrack

How AI (Claude in Cursor) was used while building this assignment, with the prompts and what changed after each iteration. The point of this log is **not** to show that I used AI — it's to show **how I think when working with it**: where I trust it, where I push back, where I rewrite.

---

## Session 1 — Prisma data model

### Prompt v1 (rejected — too generic)
> "Generate a Prisma schema for a recruiting tool with jobs, candidates, screenings, and interviews."

**What I got:** A reasonable but flat schema — `Candidate.stage` as a string with no history, `Screening.score` as a single number, no audit trail.

**Why I rejected it:** Two requirements would break:
- The dashboard needs **time-in-stage** analytics → I need a stage-event audit, not just a current value.
- The screener returns 3 dimensions + reasoning + question list → flattening to a single `score: Float` would lose the structured AI output.

### Prompt v2 (accepted with edits)
> "I'm building a recruiting pipeline tool with these features:
> - Drag candidates between stages — I need to compute time-in-stage later for the dashboard, so model stage history.
> - AI screening returns 3 sub-scores (skills/experience/culture, 0-10), reasoning per dimension, strengths array, concerns array, and a list of {topic, question, why} prescreen questions. SQLite-friendly storage.
> - Interviews need conflict detection by HR (across all candidates), and a status lifecycle (SCHEDULED/COMPLETED/CANCELLED).
> - One job has many candidates; one candidate has many screenings (HR may re-screen against a new JD).
> Generate the Prisma schema with cuid IDs, indexes on FKs, and inline comments explaining non-obvious choices."

**Edits I made after Claude's output:**
- Renamed `Screening` → `ResumeScreening` (clearer next to `Interview`).
- Added `overallScore: Float` (computed weighted, server-side) — Claude proposed only the 3 sub-scores. I want to sort/filter by one number on the Kanban.
- Added `modelUsed` on `ResumeScreening` so we can A/B prompts in the future and know which screenings used which model.
- Added `StageEvent.note` so HR can leave a comment when moving someone (e.g. "After prescreen call — strong on backend").

**Final schema:** `prisma/schema.prisma`. The comments at the top of the file justify each non-obvious decision so future me / a reviewer understands the trade-offs.

---

## Session 2 — Module 1 prompt (the big one)

This is the one the assignment specifically called out as "the heart of the assignment". I iterated this 3 times.

### Prompt v1 — naive

```
You are a recruiter. Score this candidate's resume against the job.

Resume: {resume}
Job: {job}

Output JSON: { skills, experience, culture, strengths, weaknesses, summary }
```

**What broke:**
- Claude often wrapped the JSON in ```json ... ``` fences. JSON.parse failed.
- Scores came out as 7/10 / 8/10 / 6/10 (mixing scales). Hard to chart.
- Reasoning was generic ("good experience"). Useless for a hiring manager who needs evidence.
- "Weaknesses" was treated like an interview liability list — too negative for HR to share with a candidate. The PDF asked for "questions to probe in the prescreen call", which is more constructive.

### Prompt v2 — strict schema, JSON-only

```
SYSTEM: You are a recruiter. Output ONLY a JSON object — no prose, no markdown.

Schema:
{ "skillsScore": number (0-10), "experienceScore": number (0-10), "cultureScore": number (0-10),
  "strengths": string[], "concerns": string[], "questions": string[], "summary": string }
```

**Better, but still:**
- The prescreen questions were generic ("Tell me about yourself", "What are your strengths?") — same questions for every candidate.
- Reasoning paragraphs were 1-2 generic sentences. No evidence linking back to the resume.
- Variance between runs: same resume → score swung from 6 to 8 sometimes.

### Prompt v3 — the production version (`src/lib/screen-resume.ts`)

Three changes that turned it from a toy into something HR would actually use:

1. **Force evidence-based reasoning** in the system prompt:
   > "Be specific and evidence-based. Reasoning sentences must reference concrete signals from the resume (companies, years, technologies, scope). Never invent details that aren't in the resume."

2. **Restructure prescreen questions as `{topic, question, why}`** so HR knows *why* this specific question was suggested for *this specific candidate*.
   This is the single biggest UX improvement — the score number is just a sorting hint; the questions are what HR actually uses on the call.

3. **Lower temperature to 0.2** for stability and add a numbered rubric (0-3 / 4-6 / 7-8 / 9-10) so the model anchors to the same scale across runs.

**Defensive code I added:**
- `extractJSON()` strips fences and locates the first `{` — handles any stray prose.
- Server-side score clamping `[0, 10]` — defensive against model going off-rubric.
- Server-side weighted overall: 45% skills + 35% experience + 20% culture. **Computed on the server, not the model**, because (a) it should be deterministic and (b) HR/leadership may want to tune the weights without re-prompting.

### Cost & latency
- Avg ~1500 input tokens (job + resume) + ~700 output tokens.
- ~3-5s end-to-end with Sonnet 4.5.
- Acceptable for an interactive flow; HR clicks one button and waits — UI shows a spinner with `"Asking Claude…"` so they know it's working.

---

## Session 3 — Module 4 prompt (the one I almost overcomplicated)

### Prompt v1 — kitchen sink (rejected)

I started by giving Claude the entire candidate list as JSON and asking for a free-form report.

**Problems:**
- Prompt got long (~5K tokens with 50 candidates) — slow + expensive.
- Output structure varied wildly between runs (sometimes a numbered list, sometimes paragraphs, sometimes markdown headers). Couldn't render it consistently.
- The model occasionally invented numbers ("conversion rate is 23%" — actually 18%). Confidently wrong.

### Prompt v2 — give it numbers, not raw data (`src/lib/ai-report.ts`)

Instead of sending raw candidates, I **pre-compute the stats** in `src/lib/dashboard.ts` and send only the small JSON snapshot:

```ts
{ totals: {...}, funnel: [...], bySource: [...], scoreBuckets: {...} }
```

Then I ask the model to *interpret*, not *aggregate*. Two reasons:
1. **Deterministic numbers** — the dashboard chart and the AI report cite the same values, computed once.
2. **Cheaper, faster, more reliable** — input is now ~300 tokens instead of 5K.

### Final prompt structure

- **System:** "Reference specific numbers from the snapshot. Never make up values."
- **Schema:** strict JSON with `headline`, `summary`, `insights[]`, `recommendations[]` (each with `action` + `rationale`), and a self-reported `confidence: low | medium | high`.
- The **`confidence` field is critical** — when there are <10 candidates total, the model honestly says "low confidence" instead of writing a confident hot take. This is a small thing but a big trust signal for HR.

---

## Verified outputs — real Claude API responses

Both prompts above were run end-to-end against the real Anthropic API (`claude-sonnet-4-6`, temperature 0.2) using `pnpm tsx scripts/test-ai.ts`. Raw JSON dumps live in [`scripts/outputs/`](./scripts/outputs/) and are reproduced here as evidence. **No hand-editing — these are exactly what Claude returned.**

### Module 1 — Resume Screener output

Input: seeded JD `Full Stack Developer` + sample resume for *Jane Doe* (5 yrs, Next.js + Postgres + OpenAI 2022). Latency: **30.9s**, output ~700 tokens.

```json
{
  "skillsScore": 9.5,
  "experienceScore": 9,
  "cultureScore": 8.5,
  "skillsReasoning": "Jane's stack is an almost exact match: TypeScript, Next.js 14, Node.js, PostgreSQL with Prisma, and Vercel/AWS are all explicitly listed in the JD's must-haves. She also covers both nice-to-haves — OpenAI integration (2022, early adopter) and cloud deployment (AWS + Vercel) — and her open-source Prisma plugins (~600 GitHub stars combined) demonstrate depth beyond day-to-day work.",
  "experienceReasoning": "Jane has 5 years of cumulative full-stack production experience (TechCorp 3 yrs + Startup 2 yrs), clearing the 3-year minimum with room to spare. At TechCorp she owned a high-stakes Rails-to-Next.js migration serving 80k DAU and designed schemas for orders and billing — two of the most complexity-heavy domains in any product…",
  "cultureReasoning": "Mentoring 3 junior engineers and running weekly code-review office hours signals strong written/verbal communication and a collaborative mindset that fits an async-first team. Speaking at JSConf TH 2024 indicates she can articulate technical ideas clearly to a public audience…",
  "strengths": [
    "Production Next.js 14 + tRPC experience at scale (80k DAU) — directly mirrors the JD's core stack",
    "PostgreSQL schema design for complex domains (orders & billing) with Prisma migrations",
    "Early OpenAI API integration (2022) satisfies the LLM/AI nice-to-have",
    "Open-source Prisma plugins with ~600 stars — concrete, verifiable side-project evidence",
    "Demonstrated mentorship and code-review culture — reduces onboarding overhead for the team"
  ],
  "concerns": [
    "MongoDB was used at the Startup but no mention of advanced relational query optimization or large-scale PostgreSQL tuning — worth probing depth beyond schema design",
    "tRPC is not explicitly listed in the JD; confirm she can work with REST or GraphQL patterns if the team's backend differs",
    "No explicit mention of unit/integration testing frameworks (Jest, Vitest, Playwright) despite the JD emphasizing solid testing habits",
    "Current role is at a single company for 3 years — verify she is comfortable with the pace and ambiguity of a potentially smaller or faster-moving team"
  ],
  "prescreenQuestions": [
    {
      "topic": "Testing habits",
      "question": "Can you walk me through the testing strategy you used during the Next.js migration at TechCorp — what frameworks did you use, what coverage targets did you set, and how did you enforce them in code review?",
      "why": "The JD explicitly requires solid testing habits, but the resume has no mention of testing tools or coverage practices, making this a gap that must be validated."
    },
    {
      "topic": "Schema design depth",
      "question": "You designed the PostgreSQL schemas for orders and billing at TechCorp. Can you describe a specific schema decision that was non-obvious — for example, how you handled soft deletes, multi-currency, or high-write concurrency?",
      "why": "Relational schema design is a must-have; this probes whether her ownership was architectural or primarily implementation-level."
    }
    // … 4 more questions, see scripts/outputs/module1-screening.json
  ],
  "summary": "Jane Doe is a Bangkok-based Senior Full Stack Engineer whose 5-year track record maps almost perfectly onto the JD… The primary gaps to probe are testing practices (no frameworks mentioned on the resume) and the depth of her relational database expertise beyond schema design… Strong recommend to advance to a technical screen."
}
```

**What I noticed reading this output:**
- The model cited *specific signals* (`80k DAU`, `~600 stars`, `2022 OpenAI`) from the resume — exactly what the v3 system prompt asked for.
- "Concerns" stayed constructive (gaps to probe, not red flags) — the v3 reframing from "weaknesses" worked.
- Each prescreen question's `why` field references either the JD or a specific resume signal — useful for HR who hasn't met the candidate.
- The closing `"Strong recommend to advance"` is exactly the kind of actionable summary the assignment asked for.

### Module 4 — Pipeline Report output

Input: full pipeline snapshot from `computeStats()` (6 candidates, 5 active, 1 rejected, 0 hires, all unscored). Latency: **13.2s**, output ~600 tokens.

```json
{
  "headline": "6-Candidate Pipeline: No Hires, No AI Scores",
  "summary": "The pipeline contains only 6 total candidates (5 active, 1 rejected), which is too small to draw statistically reliable conclusions — confidence is low. Candidates are evenly distributed across 5 stages (1 each in Applied, Screening, Pre-screen Call, First Interview, and Offer), with 0 hires to date and a 0% hire rate. All 6 candidates are unscored, eliminating AI-assisted prioritization entirely. Average time in stage is 0.85 days, suggesting the pipeline is very recent or movement tracking is incomplete.",
  "insights": [
    "All 6 candidates (100%) are unscored — no AI scores exist, making objective candidate comparison impossible at every stage.",
    "1 candidate has reached Offer stage but 0 have been hired, representing a potential close-rate risk at the final conversion step.",
    "The single rejection (1 of 6, ~17%) occurred somewhere in the funnel, but stage-level drop-off cannot be assessed meaningfully with only 1 candidate per stage.",
    "Sources are perfectly split: LinkedIn (2), JobsDB (2), and Referral (2) — no source differentiation is possible yet; effectiveness data requires more volume.",
    "Avg time in stage of 0.85 days across 5 active candidates suggests either very recent pipeline creation or that stage timestamps are not being consistently recorded."
  ],
  "recommendations": [
    {
      "action": "Trigger AI scoring for all 6 unscored candidates immediately.",
      "rationale": "100% unscored pipeline removes objective ranking; scoring enables prioritization before the Offer-stage candidate advances further."
    },
    {
      "action": "Confirm and close the 1 Offer-stage candidate this week.",
      "rationale": "With 0 hires and 1 candidate at Offer, this is the single highest-leverage action to move hire rate above 0%."
    },
    {
      "action": "Verify stage timestamp logging is functioning correctly.",
      "rationale": "Avg time of 0.85 days across all stages is implausibly low and may indicate tracking gaps distorting future cycle-time analysis."
    },
    {
      "action": "Add at least 10 more candidates before drawing source-effectiveness conclusions.",
      "rationale": "2 candidates per source is insufficient to evaluate LinkedIn vs. JobsDB vs. Referral ROI with any confidence."
    }
  ],
  "confidence": "low"
}
```

**What I noticed reading this output:**
- `confidence: "low"` — exactly the honest behaviour I designed for. With only 6 seeded candidates, a confident hot take would be misleading.
- The model surfaced a **data-quality flag** I didn't explicitly ask for ("Avg time of 0.85 days… is implausibly low and may indicate tracking gaps") — that's the kind of insight a senior recruiter would catch, not a generic LLM.
- Every insight cites a number from the snapshot (`6`, `100%`, `0%`, `~17%`, `0.85 days`). The "give it numbers, not raw data" approach paid off — no hallucinated stats.
- Recommendations are all actionable + ranked by leverage (close the Offer-stage candidate first; that's exactly right).

---

## Session 4 — UX iterations (smaller, but mattered)

### Schedule dialog: "Fill from AI"
First version of the schedule dialog had an empty description box. I realized the *whole point* of having AI screening is that the questions should flow into the interview. Added a "Fill from AI" button that pulls the latest screening's prescreen questions into the description, formatted as a numbered list with the candidate name and AI summary at the top.

This now matches the assignment's Module 3 ask: *"พร้อมแนบคำอธิบายเพิ่มเติม description เกี่ยวกับคำถามที่ต้องถามเพิ่มนอกเหนือจากใน resume (จาก module 1)"* — the link between modules 1 and 3.

### Conflict detection UX
First version blocked saving on any conflict. Then I realized: HR sometimes *intentionally* wants to schedule overlapping (different interviewers running parallel calls). So the UX is: warn first, then allow "Save anyway" as a destructive action. This way the system surfaces the risk without being paternalistic.

### Score colour threshold consistency
Initially each score visualization picked its own thresholds (one used 8/5, another 7/4). I extracted the rule into `ScoreBar` and reuse the same `>=7.5 / >=5 / else` triplet *everywhere*: Kanban card, list, detail page, dashboard buckets. Looks like one product instead of five disconnected views.

### Google Calendar integration — pick the boring solution
First pass generated a `https://meet.google.com/<random>-<random>-<random>` URL and stored it as `meetLink`. **It looks legitimate but the link doesn't resolve** — a reviewer clicking "Join Meet" gets a 404.

The brief explicitly says "Google Meeting Calendar". I considered three options:
1. **Calendar deep-link** (`calendar.google.com/calendar/render?action=TEMPLATE&...`) — open Google Calendar in HR's browser prefilled, let HR click Save. Google then attaches a real Meet link automatically and emails the candidate.
2. **Calendar API + Service Account** — automatic but requires Workspace + domain-wide delegation; events are owned by a service account, not the HR.
3. **Per-user OAuth (Calendar API)** — full automation but requires consent screen, redirect URIs, refresh-token storage. Heavy for a take-home.

I picked **(1)** because:
- It's the only option where the deployed app (Vercel) doesn't need any Google credentials at all — the entire Google integration is a stable, decade-old URL contract.
- The Meet link is issued by Google, in HR's account, with HR as the organizer — which is the *correct* ownership model anyway. A service account being the organizer of every interview is actually a downside, not an upside.
- The "extra click in Google Calendar to Save" cost is minimal because that's exactly where HR wants to do final review (attendees, time-zone, conferencing options) before sending.
- Falls back gracefully to `.ics` download for HR who use Outlook / Apple Calendar.

Implementation: `buildGoogleCalendarUrl()` in `src/lib/interview.ts` builds the URL with `text` (title), `dates` (UTC `YYYYMMDDTHHmmssZ` range), `details` (auto-includes the AI screening's prescreen questions), and `add` (candidate email). The schedule dialog's success toast surfaces the link as an immediate CTA so HR doesn't have to hunt for it.

The mock `meet.google.com/...` link was kept as a *reference id* (now `generateMeetRefId()`) so each interview still has a stable, copy-pasteable identifier inside the .ics file — but it's no longer surfaced as a clickable "Join Meet" link in the UI, which would be misleading.

---

## What I learned

1. **AI is great at structured output if you're strict about it.** Show the schema, set temperature low, force JSON-only in the system prompt. Don't trust prose.
2. **Don't ask the model to do math.** Compute stats deterministically, then ask the model to *interpret*. Cheaper, faster, no hallucinated numbers.
3. **The prompt is the spec.** When v1 didn't give me what I wanted, the fix was almost always to be more specific about the *use case*, not to add more constraints. "These questions get used on a 30-min phone screen by an HR person who hasn't met the candidate" is more useful guidance than "be helpful and detailed".
4. **Boilerplate is where Claude shines.** UI primitives (Button, Card, Dialog) — Claude wrote them and I read-reviewed; quick wins. AI features — I iterated 3+ times each. Architecture decisions — I drove, Claude critiqued.
