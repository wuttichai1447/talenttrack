import Anthropic from "@anthropic-ai/sdk";

/**
 * Lazy-initialized Anthropic client. Throws a friendly error message at request
 * time (rather than at module load) so the rest of the app can boot even when
 * ANTHROPIC_API_KEY isn't configured yet.
 */
let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env to enable AI features (Module 1 & Module 4).",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

// Default to the latest Sonnet shown in Anthropic Console at the time of writing.
// Override via ANTHROPIC_MODEL in .env if a newer model is released.
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

/**
 * Robust JSON extractor — Claude usually returns clean JSON when asked, but we
 * defensively strip code-fences and locate the first {...} block to be safe.
 */
export function extractJSON<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  // Find the first balanced JSON object/array
  const firstBrace = raw.search(/[{[]/);
  if (firstBrace === -1) throw new Error("No JSON object found in model response");
  const candidate = raw.slice(firstBrace);
  return JSON.parse(candidate) as T;
}
