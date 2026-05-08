/**
 * Resume Screener — calls Claude with a structured-output prompt and returns a
 * typed scoring object. The prompt was iterated several times (see COWORK_LOG.md
 * for the journey from generic v1 → forced JSON v2 → reasoning-rich v3).
 *
 * Why a single call (not function calling): we want minimum latency for HR's
 * interactive flow, and Claude reliably returns valid JSON when given a strict
 * schema in the prompt + a JSON-only system message.
 */
import { CLAUDE_MODEL, extractJSON, getAnthropic } from "./anthropic";

export interface ScreeningInput {
  resumeText: string;
  job: {
    title: string;
    description: string;
    requirements: string;
    niceToHave?: string | null;
  };
}

export interface PrescreenQuestion {
  topic: string;
  question: string;
  why: string;
}

export interface ScreeningResult {
  skillsScore: number;
  experienceScore: number;
  cultureScore: number;
  skillsReasoning: string;
  experienceReasoning: string;
  cultureReasoning: string;
  strengths: string[];
  concerns: string[];
  prescreenQuestions: PrescreenQuestion[];
  summary: string;
}

const SYSTEM = `You are a senior technical recruiter assistant for a Thai/SEA tech company.
Your output is consumed directly by an HR application — you MUST respond with a single JSON
object that matches the schema below. No prose before or after. No markdown fences.

Scoring rubric (0–10, integers or one decimal place):
- 0–3: clearly not a fit / missing fundamentals
- 4–6: partial fit — gaps that may be coachable
- 7–8: strong fit — meets most/all requirements
- 9–10: exceptional — exceeds requirements with evidence

Be specific and evidence-based. Reasoning sentences must reference concrete signals from
the resume (companies, years, technologies, scope). Never invent details that aren't in the resume.
Write in clear professional English (HR readers are bilingual).`;

const SCHEMA = `{
  "skillsScore": number,            // 0-10. How well technical/role-specific skills match the JD
  "experienceScore": number,        // 0-10. Depth and relevance of past experience for this role
  "cultureScore": number,           // 0-10. Communication clarity, ownership signals, team fit
  "skillsReasoning": string,        // 2-3 sentences citing specific tech & evidence
  "experienceReasoning": string,    // 2-3 sentences citing specific roles, scope, years
  "cultureReasoning": string,       // 2-3 sentences citing communication / ownership signals
  "strengths": string[],            // 3-5 concrete strengths the interviewer should leverage
  "concerns": string[],             // 2-4 risks/gaps to probe
  "prescreenQuestions": [           // 4-6 targeted questions for the prescreen call
    {
      "topic": string,              // short label, e.g. "Backend depth", "Ownership"
      "question": string,           // the actual question to ask
      "why": string                 // 1 sentence: why this question matters for THIS candidate
    }
  ],
  "summary": string                 // 3-4 sentences for HR + hiring manager: who is this candidate, why move forward (or not), what the interview should focus on
}`;

export async function screenResume(input: ScreeningInput): Promise<ScreeningResult> {
  const anthropic = getAnthropic();

  const userPrompt = `Job posting
===========
Title: ${input.job.title}

Description:
${input.job.description}

Must-have requirements:
${input.job.requirements}

${input.job.niceToHave ? `Nice-to-have:\n${input.job.niceToHave}\n` : ""}

Candidate resume
================
${input.resumeText}

Task
====
Evaluate the candidate against the job above. Return ONLY a JSON object matching this schema (no markdown, no prose):
${SCHEMA}`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    temperature: 0.2,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const parsed = extractJSON<ScreeningResult>(textBlock.text);

  // Defensive clamping in case the model goes outside [0, 10]
  parsed.skillsScore = clamp(parsed.skillsScore, 0, 10);
  parsed.experienceScore = clamp(parsed.experienceScore, 0, 10);
  parsed.cultureScore = clamp(parsed.cultureScore, 0, 10);

  return parsed;
}

function clamp(n: number, min: number, max: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Weighted overall score: skills 45%, experience 35%, culture 20%. */
export function overallScore(s: Pick<ScreeningResult, "skillsScore" | "experienceScore" | "cultureScore">) {
  return Number((s.skillsScore * 0.45 + s.experienceScore * 0.35 + s.cultureScore * 0.2).toFixed(1));
}
