/**
 * Dashboard analytics — pure functions over candidate/interview rows.
 * Kept stack-agnostic so the same logic can power a future API endpoint.
 */
import { ACTIVE_STAGES, STAGES, type StageId } from "./stages";

export interface CandidateForStats {
  id: string;
  stage: string;
  source: string;
  appliedAt: Date | string;
  job: { id: string; title: string };
  createdAt: Date | string;
  events: Array<{ fromStage: string | null; toStage: string; createdAt: Date | string }>;
  screenings: Array<{ overallScore: number; createdAt: Date | string }>;
}

export interface InterviewForStats {
  id: string;
  scheduledAt: Date | string;
  status: string;
  candidate: { id: string; name: string };
}

export interface DashboardStats {
  totalCandidates: number;
  activeCandidates: number;
  hired: number;
  rejected: number;
  hireRate: number;       // hired / (hired + rejected)
  avgAiScore: number | null;
  avgTimeInStageDays: number | null;
  upcomingInterviews: number;
  byStage: Record<StageId, number>;
  bySource: Array<{ source: string; count: number }>;
  funnel: Array<{ stage: StageId; label: string; count: number; pct: number }>;
  scoreBuckets: { strong: number; mixed: number; weak: number; unscored: number };
}

export function computeStats(
  candidates: CandidateForStats[],
  interviews: InterviewForStats[],
): DashboardStats {
  const byStage = STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s.id] = 0;
    return acc;
  }, {}) as Record<StageId, number>;

  const bySourceMap = new Map<string, number>();
  let totalScore = 0;
  let scoreCount = 0;
  const buckets = { strong: 0, mixed: 0, weak: 0, unscored: 0 };
  let timeAccum = 0;
  let timeCount = 0;

  for (const c of candidates) {
    byStage[c.stage as StageId] = (byStage[c.stage as StageId] ?? 0) + 1;
    bySourceMap.set(c.source, (bySourceMap.get(c.source) ?? 0) + 1);

    const score = c.screenings[0]?.overallScore;
    if (score !== undefined) {
      totalScore += score;
      scoreCount++;
      if (score >= 7.5) buckets.strong++;
      else if (score >= 5) buckets.mixed++;
      else buckets.weak++;
    } else {
      buckets.unscored++;
    }

    // Time-in-current-stage = now - last stage event for current stage
    const lastEvent = c.events
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (lastEvent) {
      const days = (Date.now() - new Date(lastEvent.createdAt).getTime()) / 86_400_000;
      if (ACTIVE_STAGES.includes(c.stage as StageId)) {
        timeAccum += days;
        timeCount++;
      }
    }
  }

  const hired = byStage["HIRED"] ?? 0;
  const rejected = byStage["REJECTED"] ?? 0;
  const active = ACTIVE_STAGES.reduce((sum, s) => sum + (byStage[s] ?? 0), 0);
  const total = candidates.length;
  const hireRate = hired + rejected > 0 ? hired / (hired + rejected) : 0;

  // Funnel: percentage of total reaching each successive stage
  const funnel = STAGES.filter((s) => s.id !== "REJECTED").map((s) => {
    const count = byStage[s.id] ?? 0;
    return {
      stage: s.id,
      label: s.label,
      count,
      pct: total > 0 ? count / total : 0,
    };
  });

  const upcomingInterviews = interviews.filter(
    (i) =>
      i.status === "SCHEDULED" &&
      new Date(i.scheduledAt).getTime() >= Date.now() - 60 * 60 * 1000,
  ).length;

  return {
    totalCandidates: total,
    activeCandidates: active,
    hired,
    rejected,
    hireRate,
    avgAiScore: scoreCount > 0 ? totalScore / scoreCount : null,
    avgTimeInStageDays: timeCount > 0 ? timeAccum / timeCount : null,
    upcomingInterviews,
    byStage,
    bySource: Array.from(bySourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    funnel,
    scoreBuckets: buckets,
  };
}
