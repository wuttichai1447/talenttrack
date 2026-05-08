import type { Candidate, Job } from "@prisma/client";

export type CandidateWithRelations = Candidate & {
  job: Pick<Job, "id" | "title">;
  screenings: Array<{ id: string; overallScore: number; createdAt: Date }>;
  _count: { interviews: number };
};

export type JobLite = Pick<Job, "id" | "title" | "department" | "location"> & {
  description?: string;
  requirements?: string;
};
