/**
 * Quick smoke test for both AI features.
 *
 *   pnpm tsx scripts/test-ai.ts
 *
 * 1. Verifies ANTHROPIC_API_KEY is set
 * 2. Calls the screening prompt with a sample resume against the seeded JD
 * 3. Calls the pipeline report prompt against the live DB stats
 *
 * Both calls run end-to-end through the same code paths the API routes use,
 * so success here = your API key + both prompts work.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { computeStats } from "../src/lib/dashboard";
import { generatePipelineReport } from "../src/lib/ai-report";
import { overallScore, screenResume } from "../src/lib/screen-resume";

const SAMPLE_RESUME = `
Jane Doe
Senior Software Engineer
jane.doe@example.com · +66 81 234 5678 · Bangkok, Thailand

EXPERIENCE
TechCorp (2022 – Present, 3 yrs) — Senior Full Stack Engineer
- Led the migration of a Rails monolith to a Next.js + tRPC stack serving 80k DAU.
- Designed PostgreSQL schemas and managed migrations for the orders & billing domains.
- Mentored 3 junior engineers; ran weekly code review office hours.
- Tech: TypeScript, Next.js 14, Node.js, PostgreSQL, Prisma, Redis, AWS, Vercel.

Startup (2020 – 2022, 2 yrs) — Full Stack Engineer
- Shipped the MVP from zero with React, Node.js, MongoDB. Reached 10k MAU.
- Integrated OpenAI for an in-app drafting assistant (early adopter, 2022).

EDUCATION
B.Sc. Computer Engineering, Chulalongkorn University, 2020.

OTHER
- Open source: 2 popular Prisma plugins (~600 stars combined).
- Speaker at JSConf TH 2024.
`.trim();

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✗ ANTHROPIC_API_KEY is not set in .env");
    process.exit(1);
  }
  console.log("✓ ANTHROPIC_API_KEY found");

  const job = await prisma.job.findFirst();
  if (!job) {
    console.error("✗ No job in DB. Run `pnpm db:seed` first.");
    process.exit(1);
  }
  console.log(`✓ Found job: ${job.title}`);

  // --- Module 1: screening ---
  console.log("\n→ Module 1: AI Resume Screener");
  console.time("  screening latency");
  const result = await screenResume({
    resumeText: SAMPLE_RESUME,
    job: {
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      niceToHave: job.niceToHave,
    },
  });
  console.timeEnd("  screening latency");
  console.log(`  Skills:     ${result.skillsScore.toFixed(1)}/10`);
  console.log(`  Experience: ${result.experienceScore.toFixed(1)}/10`);
  console.log(`  Culture:    ${result.cultureScore.toFixed(1)}/10`);
  console.log(`  Overall (weighted): ${overallScore(result).toFixed(1)}/10`);
  console.log(`  Strengths: ${result.strengths.length}, Concerns: ${result.concerns.length}, Questions: ${result.prescreenQuestions.length}`);
  console.log(`  Summary: "${result.summary.slice(0, 120)}…"`);

  // --- Module 4: pipeline report ---
  console.log("\n→ Module 4: AI Pipeline Report");
  const candidates = await prisma.candidate.findMany({
    include: {
      job: { select: { id: true, title: true } },
      events: { select: { fromStage: true, toStage: true, createdAt: true } },
      screenings: { orderBy: { createdAt: "desc" }, take: 1, select: { overallScore: true, createdAt: true } },
    },
  });
  const interviews = await prisma.interview.findMany({
    select: { id: true, scheduledAt: true, status: true, candidate: { select: { id: true, name: true } } },
  });
  const stats = computeStats(candidates, interviews);
  console.time("  report latency");
  const report = await generatePipelineReport(stats);
  console.timeEnd("  report latency");
  console.log(`  Headline: "${report.headline}"`);
  console.log(`  Confidence: ${report.confidence}`);
  console.log(`  Insights: ${report.insights.length}, Recommendations: ${report.recommendations.length}`);
  console.log(`  Summary: "${report.summary.slice(0, 120)}…"`);

  // Persist raw outputs so we can attach them to COWORK_LOG.md
  const outDir = path.join(process.cwd(), "scripts", "outputs");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "module1-screening.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(outDir, "module4-report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  console.log(`\n✓ Raw outputs written to scripts/outputs/`);
  console.log("✓ Both AI features working end-to-end.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("✗ Failed:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
