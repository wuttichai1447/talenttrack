/**
 * Seed script — run with `npm run db:seed`.
 *
 * Creates 1 sample Job (Full Stack Developer) and a handful of candidates spread
 * across the pipeline so the dashboard and Kanban have realistic data on first run.
 */
import { PrismaClient } from "@prisma/client";
import { STAGES } from "../src/lib/stages";

const prisma = new PrismaClient();

const FULL_STACK_JD = {
  title: "Full Stack Developer",
  department: "Engineering",
  location: "Bangkok / Remote",
  description: `We are looking for a Full Stack Developer to join our growing engineering team.
You will own features end-to-end across our web product — from data model to UI — and partner with
designers and product managers to ship customer-facing improvements every week.`,
  requirements: `- 3+ years building production web applications
- Strong TypeScript / JavaScript fundamentals
- Experience with React (Next.js a plus) and a modern Node.js backend
- Comfortable designing relational schemas (PostgreSQL/MySQL)
- Solid testing habits and an appetite for code review
- Good written English (we have async-first remote teammates)`,
  niceToHave: `- Experience integrating with LLM/AI APIs (OpenAI, Anthropic)
- Familiarity with cloud deployment (Vercel, AWS, GCP)
- Open-source contributions or side projects you can talk about`,
};

const SAMPLE_CANDIDATES: Array<{
  name: string;
  email: string;
  phone: string;
  source: string;
  stage: (typeof STAGES)[number]["id"];
  notes?: string;
}> = [
  {
    name: "Anya Suriya",
    email: "anya.suriya@example.com",
    phone: "+66 81 234 5678",
    source: "LinkedIn",
    stage: "APPLIED",
  },
  {
    name: "Ben Chaisiri",
    email: "ben.chai@example.com",
    phone: "+66 89 555 1212",
    source: "JobsDB",
    stage: "SCREENING",
  },
  {
    name: "Chayada Lim",
    email: "chayada.lim@example.com",
    phone: "+66 84 711 0033",
    source: "Referral",
    stage: "PRE_SCREEN_CALL",
    notes: "Referred by Khun Pim from Engineering.",
  },
  {
    name: "David Tanaka",
    email: "david.tanaka@example.com",
    phone: "+66 90 222 4848",
    source: "LinkedIn",
    stage: "FIRST_INTERVIEW",
  },
  {
    name: "Emma Watanabe",
    email: "emma.w@example.com",
    phone: "+66 92 100 7777",
    source: "Referral",
    stage: "OFFER",
  },
  {
    name: "Frank Pongsak",
    email: "frank.p@example.com",
    phone: "+66 81 999 4321",
    source: "JobsDB",
    stage: "REJECTED",
    notes: "Strong React skills but limited backend experience.",
  },
];

async function main() {
  console.log("→ Cleaning existing data…");
  await prisma.stageEvent.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.resumeScreening.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();

  console.log("→ Creating job…");
  const job = await prisma.job.create({ data: FULL_STACK_JD });

  console.log(`→ Creating ${SAMPLE_CANDIDATES.length} candidates…`);
  for (const c of SAMPLE_CANDIDATES) {
    await prisma.candidate.create({
      data: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        source: c.source,
        stage: c.stage,
        notes: c.notes,
        jobId: job.id,
        events: {
          create: { fromStage: null, toStage: c.stage, note: "Seeded" },
        },
      },
    });
  }

  console.log("✓ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
