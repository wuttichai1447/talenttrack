"use client";

import { CheckCircle2, AlertTriangle, MessageSquareQuote, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreBar } from "@/components/ui/score-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ScreeningResultDisplay {
  skillsScore: number;
  experienceScore: number;
  cultureScore: number;
  overallScore: number;
  skillsReasoning: string;
  experienceReasoning: string;
  cultureReasoning: string;
  strengths: string[];
  concerns: string[];
  prescreenQuestions: { topic: string; question: string; why: string }[];
  summary: string;
}

interface Props {
  result: ScreeningResultDisplay;
  jobTitle: string;
}

export function ScoreCard({ result, jobTitle }: Props) {
  const overall = result.overallScore;
  const recommendation =
    overall >= 7.5
      ? { label: "Strong fit — advance", variant: "success" as const }
      : overall >= 5
        ? { label: "Mixed — probe in prescreen", variant: "warn" as const }
        : { label: "Likely not a fit", variant: "danger" as const };

  function buildBriefingText() {
    return [
      `Interview Briefing — ${jobTitle}`,
      "",
      `Overall score: ${overall.toFixed(1)}/10  (${recommendation.label})`,
      `• Skills:     ${result.skillsScore.toFixed(1)}/10`,
      `• Experience: ${result.experienceScore.toFixed(1)}/10`,
      `• Culture:    ${result.cultureScore.toFixed(1)}/10`,
      "",
      "Summary:",
      result.summary,
      "",
      "Strengths:",
      ...result.strengths.map((s, i) => `  ${i + 1}. ${s}`),
      "",
      "Concerns / risks:",
      ...result.concerns.map((s, i) => `  ${i + 1}. ${s}`),
      "",
      "Suggested prescreen questions:",
      ...result.prescreenQuestions.map(
        (q, i) => `  ${i + 1}. [${q.topic}] ${q.question}\n      Why: ${q.why}`,
      ),
    ].join("\n");
  }

  async function copyBriefing() {
    await navigator.clipboard.writeText(buildBriefingText());
    toast.success("Interview briefing copied");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Score card
                <Badge variant={recommendation.variant}>{recommendation.label}</Badge>
              </CardTitle>
              <CardDescription>
                Matching against <span className="font-medium text-foreground">{jobTitle}</span>
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={copyBriefing}>
              <Copy className="h-4 w-4" /> Copy briefing
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[160px,1fr] items-center">
            <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-4">
              <div
                className={cn(
                  "text-4xl font-bold tabular-nums",
                  overall >= 7.5
                    ? "text-emerald-600"
                    : overall >= 5
                      ? "text-amber-600"
                      : "text-red-600",
                )}
              >
                {overall.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">Overall · weighted</div>
            </div>
            <div className="space-y-3">
              <ScoreDimension
                label="Skills fit"
                value={result.skillsScore}
                reasoning={result.skillsReasoning}
              />
              <ScoreDimension
                label="Experience fit"
                value={result.experienceScore}
                reasoning={result.experienceReasoning}
              />
              <ScoreDimension
                label="Culture / communication fit"
                value={result.cultureScore}
                reasoning={result.cultureReasoning}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Interview team summary
            </p>
            <p className="mt-1 text-sm leading-relaxed">{result.summary}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Concerns to probe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {result.concerns.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareQuote className="h-4 w-4 text-primary" />
            Prescreen call questions
          </CardTitle>
          <CardDescription>
            Tailored to this candidate&apos;s gaps &amp; strengths — copy into the call notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {result.prescreenQuestions.map((q, i) => (
            <div key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="shrink-0">
                  {q.topic}
                </Badge>
                <p className="text-sm font-medium">{q.question}</p>
              </div>
              <p className="mt-1 ml-[5.5rem] text-xs text-muted-foreground">
                <span className="font-medium">Why:</span> {q.why}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreDimension({
  label,
  value,
  reasoning,
}: {
  label: string;
  value: number;
  reasoning: string;
}) {
  return (
    <div>
      <ScoreBar label={label} value={value} />
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{reasoning}</p>
    </div>
  );
}
