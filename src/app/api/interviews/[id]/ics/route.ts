import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcs } from "@/lib/interview";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { candidate: { include: { job: true } } },
  });
  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ics = buildIcs({
    uid: interview.id,
    title: `${interview.type === "PRESCREEN" ? "Prescreen call" : "Interview"} — ${interview.candidate.name} (${interview.candidate.job.title})`,
    description:
      (interview.description ?? "") +
      `\n\nCandidate: ${interview.candidate.name} <${interview.candidate.email}>` +
      (interview.interviewers ? `\nInterviewers: ${interview.interviewers}` : ""),
    start: interview.scheduledAt,
    durationMin: interview.durationMin,
    meetLink: interview.meetLink,
    organizerName: "TalentTrack HR",
    organizerEmail: "hr@talenttrack.example.com",
    attendeeName: interview.candidate.name,
    attendeeEmail: interview.candidate.email,
  });

  const filename = `${interview.candidate.name.replace(/\s+/g, "_")}_interview.ics`;
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
