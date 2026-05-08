import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { STAGE_IDS } from "@/lib/stages";
import { revalidatePipeline } from "@/lib/revalidate";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional().nullable(),
  source: z.string().min(1),
  jobId: z.string().min(1),
  stage: z.enum(STAGE_IDS as [string, ...string[]]).default("APPLIED"),
  notes: z.string().optional().nullable(),
  resumeText: z.string().optional().nullable(),
  resumeFile: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const jobId = searchParams.get("jobId");
  const source = searchParams.get("source");
  const q = searchParams.get("q");

  const candidates = await prisma.candidate.findMany({
    where: {
      ...(stage ? { stage } : {}),
      ...(jobId ? { jobId } : {}),
      ...(source ? { source } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      job: { select: { id: true, title: true } },
      screenings: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, overallScore: true, createdAt: true },
      },
      _count: { select: { interviews: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(candidates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const created = await prisma.candidate.create({
    data: {
      ...parsed.data,
      events: {
        create: {
          fromStage: null,
          toStage: parsed.data.stage,
          note: "Candidate added",
        },
      },
    },
    include: { job: { select: { id: true, title: true } } },
  });

  revalidatePipeline();

  return NextResponse.json(created, { status: 201 });
}
