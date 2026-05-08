import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findConflicts } from "@/lib/interview";
import { interviewWithCandidateInclude } from "../shape";

const patchSchema = z.object({
  scheduledAt: z.string().optional(),
  durationMin: z.number().int().min(15).max(240).optional(),
  description: z.string().optional().nullable(),
  interviewers: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "RESCHEDULED"]).optional(),
  ignoreConflicts: z.boolean().optional().default(false),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: interviewWithCandidateInclude,
  });
  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(interview);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.interview.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;
  const start = data.scheduledAt ? new Date(data.scheduledAt) : existing.scheduledAt;
  const duration = data.durationMin ?? existing.durationMin;

  // Conflict check on reschedule
  if ((data.scheduledAt || data.durationMin) && data.status !== "CANCELLED" && !data.ignoreConflicts) {
    const others = await prisma.interview.findMany({
      where: {
        id: { not: id },
        status: { not: "CANCELLED" },
        scheduledAt: {
          gte: new Date(start.getTime() - 6 * 60 * 60 * 1000),
          lte: new Date(start.getTime() + 6 * 60 * 60 * 1000),
        },
      },
      include: { candidate: { select: { name: true } } },
    });
    const conflicts = findConflicts(
      { scheduledAt: start, durationMin: duration },
      others.map((o) => ({ id: o.id, scheduledAt: o.scheduledAt, durationMin: o.durationMin, status: o.status })),
    );
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          conflict: true,
          message: `Time slot overlaps with ${conflicts.length} other interview(s).`,
          conflicts: conflicts.map((c) => {
            const o = others.find((x) => x.id === c.id)!;
            return { id: o.id, candidateName: o.candidate.name, scheduledAt: o.scheduledAt, durationMin: o.durationMin };
          }),
        },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.interview.update({
    where: { id },
    data: {
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      durationMin: data.durationMin,
      description: data.description,
      interviewers: data.interviewers,
      status: data.status,
    },
    include: interviewWithCandidateInclude,
  });

  // If cancelling, leave candidate stage alone but record the event
  if (data.status === "CANCELLED" && existing.status !== "CANCELLED") {
    await prisma.stageEvent.create({
      data: {
        candidateId: existing.candidateId,
        fromStage: updated.candidate.stage,
        toStage: updated.candidate.stage,
        note: "Interview cancelled",
      },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.interview.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
