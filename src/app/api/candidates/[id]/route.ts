import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { STAGE_IDS } from "@/lib/stages";
import { revalidatePipeline } from "@/lib/revalidate";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  source: z.string().optional(),
  jobId: z.string().optional(),
  stage: z.enum(STAGE_IDS as [string, ...string[]]).optional(),
  notes: z.string().optional().nullable(),
  resumeText: z.string().optional().nullable(),
  stageNote: z.string().optional(), // optional note when stage changes
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      job: true,
      screenings: { orderBy: { createdAt: "desc" } },
      interviews: { orderBy: { scheduledAt: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(candidate);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.candidate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { stageNote, ...data } = parsed.data;

  const updated = await prisma.candidate.update({
    where: { id },
    data: {
      ...data,
      // Record stage transition history
      ...(data.stage && data.stage !== existing.stage
        ? {
            events: {
              create: {
                fromStage: existing.stage,
                toStage: data.stage,
                note: stageNote ?? null,
              },
            },
          }
        : {}),
    },
    include: { job: { select: { id: true, title: true } } },
  });

  revalidatePipeline();

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.candidate.delete({ where: { id } });
  revalidatePipeline();
  return NextResponse.json({ ok: true });
}
