import { prisma } from "@/lib/prisma";
import { ACTIVE_STAGES } from "@/lib/stages";
import { PageHeader } from "@/components/page-header";
import { InterviewsView } from "./interviews-view";
import type { CandidateOption, InterviewWithCandidate } from "./types";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const [interviews, candidates] = await Promise.all([
    prisma.interview.findMany({
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            stage: true,
            job: { select: { id: true, title: true } },
            screenings: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { prescreenQuestions: true, summary: true, overallScore: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.candidate.findMany({
      where: { stage: { in: ACTIVE_STAGES as unknown as string[] } },
      select: {
        id: true,
        name: true,
        email: true,
        stage: true,
        job: { select: { id: true, title: true } },
        screenings: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { prescreenQuestions: true, summary: true, overallScore: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        badge="Module 3"
        title="Interview Scheduler"
        description="Schedule prescreen calls and interviews. Conflicts are detected before saving, then push events into your Google Calendar in one click — Google issues the real Meet link and emails the candidate. .ics download also available for Outlook / Apple."
      />
      <div className="p-6">
        <InterviewsView
          initialInterviews={interviews as unknown as InterviewWithCandidate[]}
          candidates={candidates as unknown as CandidateOption[]}
        />
      </div>
    </>
  );
}
