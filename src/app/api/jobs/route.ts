import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  description: z.string().min(1),
  requirements: z.string().min(1),
  niceToHave: z.string().optional().nullable(),
});

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { candidates: true } } },
  });
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const created = await prisma.job.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
}
