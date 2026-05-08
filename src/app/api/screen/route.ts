import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CLAUDE_MODEL } from "@/lib/anthropic";
import { extractPdfText } from "@/lib/pdf";
import { overallScore, screenResume } from "@/lib/screen-resume";
import { revalidatePipeline } from "@/lib/revalidate";

export const runtime = "nodejs";
export const maxDuration = 60;

const previewSchema = z.object({
  jobId: z.string().min(1),
  resumeText: z.string().min(50, "Resume text seems too short"),
});

// POST — body can be:
//   - JSON { jobId, resumeText }              → preview only (no candidate created)
//   - FormData with `file` (PDF) + `jobId`    → extract + preview
//   - JSON { jobId, resumeText, candidate: { name,email,... } } → screen + create candidate
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  let resumeText = "";
  let resumeFile: string | undefined;
  let jobId = "";
  let candidate:
    | { name: string; email: string; phone?: string; source?: string; notes?: string }
    | undefined;

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    jobId = String(fd.get("jobId") ?? "");
    const file = fd.get("file");
    const pasted = String(fd.get("resumeText") ?? "");
    if (file && file instanceof File) {
      resumeFile = file.name;
      const ab = await file.arrayBuffer();
      resumeText = await extractPdfText(ab);
    } else if (pasted) {
      resumeText = pasted;
    }
    const candidateRaw = fd.get("candidate");
    if (candidateRaw && typeof candidateRaw === "string") {
      try {
        candidate = JSON.parse(candidateRaw);
      } catch {
        // ignore — preview only
      }
    }
  } else {
    const body = await req.json();
    jobId = body.jobId;
    resumeText = body.resumeText ?? "";
    candidate = body.candidate;
  }

  const validation = previewSchema.safeParse({ jobId, resumeText });
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  let result;
  try {
    result = await screenResume({
      resumeText,
      job: {
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        niceToHave: job.niceToHave,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to screen resume with Claude";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const overall = overallScore(result);

  // If candidate info provided, persist candidate + screening
  if (candidate?.name && candidate.email) {
    const created = await prisma.candidate.create({
      data: {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone || null,
        source: candidate.source || "Resume Screener",
        notes: candidate.notes || null,
        jobId: job.id,
        stage: "SCREENING",
        resumeText,
        resumeFile: resumeFile ?? null,
        events: {
          create: { fromStage: null, toStage: "SCREENING", note: "Created via Resume Screener" },
        },
        screenings: {
          create: {
            skillsScore: result.skillsScore,
            experienceScore: result.experienceScore,
            cultureScore: result.cultureScore,
            overallScore: overall,
            skillsReasoning: result.skillsReasoning,
            experienceReasoning: result.experienceReasoning,
            cultureReasoning: result.cultureReasoning,
            strengths: JSON.stringify(result.strengths),
            concerns: JSON.stringify(result.concerns),
            prescreenQuestions: JSON.stringify(result.prescreenQuestions),
            summary: result.summary,
            modelUsed: CLAUDE_MODEL,
          },
        },
      },
      include: {
        job: { select: { id: true, title: true } },
        screenings: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    revalidatePipeline();

    return NextResponse.json({
      candidate: created,
      result: { ...result, overallScore: overall },
      resumeFile,
      saved: true,
    });
  }

  return NextResponse.json({
    result: { ...result, overallScore: overall },
    resumeText,
    resumeFile,
    saved: false,
    jobTitle: job.title,
  });
}
