import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ScreenForm } from "./screen-form";

export const dynamic = "force-dynamic";

export default async function ScreenPage() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      description: true,
      requirements: true,
      niceToHave: true,
    },
  });

  return (
    <>
      <PageHeader
        badge="Module 1"
        title="AI Resume Screener"
        description="Upload a CV (PDF) or paste text, choose a job, and let Claude score the candidate across Skills, Experience, and Culture fit — with reasoning, strengths, and prescreen-call questions."
      />
      <div className="p-6">
        <ScreenForm jobs={jobs} />
      </div>
    </>
  );
}
