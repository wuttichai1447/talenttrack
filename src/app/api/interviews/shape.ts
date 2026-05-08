import type { Prisma } from "@prisma/client";

/**
 * Shared Prisma include shape used by every endpoint that returns an interview.
 * Keeping this in one place guarantees POST/PATCH/GET responses share an identical
 * shape — front-end code can rely on `it.candidate.screenings[0]?.overallScore`
 * regardless of which endpoint produced the row.
 */
export const interviewWithCandidateInclude = {
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
        select: {
          id: true,
          overallScore: true,
          summary: true,
          prescreenQuestions: true,
        },
      },
    },
  },
} satisfies Prisma.InterviewInclude;
