import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/dashboard";
import { generatePipelineReport } from "@/lib/ai-report";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");

  const [candidates, interviews, job] = await Promise.all([
    prisma.candidate.findMany({
      where: jobId ? { jobId } : {},
      include: {
        job: { select: { id: true, title: true } },
        events: { select: { fromStage: true, toStage: true, createdAt: true } },
        screenings: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { overallScore: true, createdAt: true },
        },
      },
    }),
    prisma.interview.findMany({
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        candidate: { select: { id: true, name: true } },
      },
    }),
    jobId ? prisma.job.findUnique({ where: { id: jobId } }) : Promise.resolve(null),
  ]);

  const stats = computeStats(candidates, interviews);

  try {
    const report = await generatePipelineReport(stats, { jobTitle: job?.title });
    return NextResponse.json({ stats, report });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI report failed", stats },
      { status: 500 },
    );
  }
}
