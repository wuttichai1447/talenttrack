/**
 * Pipeline AI Report — Module 4 supplement.
 *
 * Given a snapshot of pipeline metrics, ask Claude for a 1-paragraph
 * executive summary plus 3-5 specific, actionable recommendations for HR.
 * The output is consumed by the dashboard, so we enforce strict JSON.
 */
import { CLAUDE_MODEL, extractJSON, getAnthropic } from "./anthropic";
import type { DashboardStats } from "./dashboard";

export interface PipelineReport {
  headline: string;     // 1 line title
  summary: string;      // 2-4 sentences executive summary
  insights: string[];   // 3-5 specific bullets, each grounded in the numbers
  recommendations: Array<{ action: string; rationale: string }>;
  // Confidence the model has, given the data volume — short label
  confidence: "low" | "medium" | "high";
}

const SYSTEM = `You are a senior recruiting operations analyst. Output ONLY JSON
matching the schema. Insights must reference specific numbers from the data — never make up values.
Be concise, concrete, and actionable. No fluff. No marketing language.`;

const SCHEMA = `{
  "headline": string,                       // <= 8 words
  "summary": string,                        // 2-4 sentences referencing numbers
  "insights": string[],                     // 3-5 bullets; each cites at least one specific stat
  "recommendations": [
    { "action": string, "rationale": string }   // each <= 25 words
  ],
  "confidence": "low" | "medium" | "high"   // based on data volume / variance
}`;

export async function generatePipelineReport(
  stats: DashboardStats,
  options: { jobTitle?: string } = {},
): Promise<PipelineReport> {
  const anthropic = getAnthropic();

  const compactStats = {
    jobTitle: options.jobTitle,
    totals: {
      total: stats.totalCandidates,
      active: stats.activeCandidates,
      hired: stats.hired,
      rejected: stats.rejected,
      hireRate: Number(stats.hireRate.toFixed(2)),
      upcomingInterviews: stats.upcomingInterviews,
      avgAiScore: stats.avgAiScore !== null ? Number(stats.avgAiScore.toFixed(2)) : null,
      avgTimeInStageDays:
        stats.avgTimeInStageDays !== null ? Number(stats.avgTimeInStageDays.toFixed(2)) : null,
    },
    funnel: stats.funnel,
    bySource: stats.bySource,
    scoreBuckets: stats.scoreBuckets,
  };

  const userPrompt = `Pipeline snapshot (JSON):
${JSON.stringify(compactStats, null, 2)}

Task: write a short executive report for the HR lead and hiring manager.
- Reference specific numbers from the snapshot.
- Insights should highlight bottlenecks (e.g. stage with biggest drop), source effectiveness, AI score distribution.
- Recommendations should be concrete next actions HR can take this week.
- If data is sparse (e.g. <10 total candidates), set confidence to "low" and say so honestly in the summary.

Return ONLY JSON matching this schema:
${SCHEMA}`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    temperature: 0.3,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Claude returned no text content");

  return extractJSON<PipelineReport>(block.text);
}
