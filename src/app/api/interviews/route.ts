import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findConflicts, generateMeetLink } from "@/lib/interview";
import { interviewWithCandidateInclude } from "./shape";

const createSchema = z.object({
  candidateId: z.string().min(1),
  scheduledAt: z.string().min(1), // ISO string
  durationMin: z.number().int().min(15).max(240).default(30),
  type: z.enum(["PRESCREEN", "FIRST_INTERVIEW", "FINAL"]).default("PRESCREEN"),
  description: z.string().optional().nullable(),
  interviewers: z.string().optional().nullable(),
  ignoreConflicts: z.boolean().optional().default(false),
});

// GET /api/interviews?candidateId=&from=&to=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get("candidateId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const interviews = await prisma.interview.findMany({
    where: {
      ...(candidateId ? { candidateId } : {}),
      ...(from || to
        ? {
            scheduledAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: interviewWithCandidateInclude,
    orderBy: { scheduledAt: "asc" },
  });
  return NextResponse.json(interviews);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { candidateId, scheduledAt, durationMin, type, description, interviewers, ignoreConflicts } =
    parsed.data;

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  const start = new Date(scheduledAt);

  // Conflict detection across ALL interviews (HR perspective)
  const existing = await prisma.interview.findMany({
    where: {
      status: { not: "CANCELLED" },
      scheduledAt: {
        // pull a wide window to catch overlaps
        gte: new Date(start.getTime() - 6 * 60 * 60 * 1000),
        lte: new Date(start.getTime() + 6 * 60 * 60 * 1000),
      },
    },
    include: {
      candidate: { select: { id: true, name: true, email: true } },
    },
  });

  const conflicts = findConflicts(
    { scheduledAt: start, durationMin },
    existing.map((e) => ({
      id: e.id,
      scheduledAt: e.scheduledAt,
      durationMin: e.durationMin,
      status: e.status,
    })),
  );

  if (conflicts.length > 0 && !ignoreConflicts) {
    const detail = conflicts.map((c) => {
      const e = existing.find((x) => x.id === c.id)!;
      return {
        id: e.id,
        scheduledAt: e.scheduledAt,
        durationMin: e.durationMin,
        candidateName: e.candidate.name,
      };
    });
    return NextResponse.json(
      {
        conflict: true,
        message: `Time slot overlaps with ${conflicts.length} existing interview(s).`,
        conflicts: detail,
      },
      { status: 409 },
    );
  }

  const meetLink = generateMeetLink();

  const interview = await prisma.interview.create({
    data: {
      candidateId,
      scheduledAt: start,
      durationMin,
      type,
      description: description || null,
      interviewers: interviewers || null,
      meetLink,
    },
    include: interviewWithCandidateInclude,
  });

  // Auto-advance candidate stage if it makes sense
  const targetStage =
    type === "PRESCREEN"
      ? "PRE_SCREEN_CALL"
      : type === "FIRST_INTERVIEW"
        ? "FIRST_INTERVIEW"
        : null;

  if (targetStage && candidate.stage !== targetStage && candidate.stage !== "OFFER" && candidate.stage !== "HIRED") {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        stage: targetStage,
        events: {
          create: {
            fromStage: candidate.stage,
            toStage: targetStage,
            note: "Interview scheduled",
          },
        },
      },
    });
  }

  return NextResponse.json(interview, { status: 201 });
}
