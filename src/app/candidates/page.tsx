import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { CandidatesView } from "./candidates-view";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const [candidates, jobs] = await Promise.all([
    prisma.candidate.findMany({
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
    }),
    prisma.job.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <PageHeader
        badge="Module 2"
        title="Applicant Tracker"
        description="Manage candidates across the pipeline. Drag cards between stages, filter by source or job, and open any candidate to see AI screening details and interviews."
      />
      <div className="p-6">
        <CandidatesView initialCandidates={candidates} jobs={jobs} />
      </div>
    </>
  );
}
