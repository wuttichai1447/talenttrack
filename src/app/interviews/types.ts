export interface CandidateOption {
  id: string;
  name: string;
  email: string;
  stage: string;
  job: { id: string; title: string };
  screenings: Array<{
    prescreenQuestions: string;
    summary: string;
    overallScore: number;
  }>;
}

export interface InterviewWithCandidate {
  id: string;
  candidateId: string;
  scheduledAt: string | Date;
  durationMin: number;
  type: string;
  meetLink: string;
  description: string | null;
  status: string;
  interviewers: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  candidate: CandidateOption;
}
