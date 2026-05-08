"use client";

import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Download,
  Edit3,
  X,
  ExternalLink,
  Sparkles,
  CalendarPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, safeJSON } from "@/lib/utils";
import { buildGoogleCalendarUrl } from "@/lib/interview";
import type { InterviewWithCandidate } from "./types";

interface Props {
  interviews: InterviewWithCandidate[];
  onEdit: (id: string) => void;
  onCancel: (id: string) => void;
  compact?: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  PRESCREEN: "Prescreen call",
  FIRST_INTERVIEW: "First interview",
  FINAL: "Final round",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "danger" | "success" | "warn" | "outline"> = {
  SCHEDULED: "default",
  COMPLETED: "success",
  CANCELLED: "danger",
  RESCHEDULED: "warn",
};

/** Build the deep-link URL HR clicks to push the event into their own Google Calendar. */
function calendarUrlFor(it: InterviewWithCandidate): string {
  const screening = it.candidate.screenings?.[0];
  const questions = screening
    ? safeJSON<Array<{ topic: string; question: string }>>(screening.prescreenQuestions, [])
    : [];

  // Compose a description that gives the interviewer everything they need
  // inside Google Calendar without flipping back to TalentTrack.
  const descriptionParts: string[] = [];
  if (it.description) descriptionParts.push(it.description);
  if (descriptionParts.length === 0 && questions.length > 0) {
    descriptionParts.push("Suggested questions (from AI screening):");
    descriptionParts.push(...questions.map((q, i) => `${i + 1}. [${q.topic}] ${q.question}`));
  }
  if (it.interviewers) descriptionParts.push(`\nInterviewers: ${it.interviewers}`);
  descriptionParts.push(
    `\n— Click "Add Google Meet video conferencing" in Google Calendar to attach a real Meet link, then Save to email the candidate.`,
  );

  return buildGoogleCalendarUrl({
    title: `${TYPE_LABEL[it.type] ?? "Interview"} — ${it.candidate.name}`,
    description: descriptionParts.join("\n"),
    start: it.scheduledAt,
    durationMin: it.durationMin,
    attendeeEmail: it.candidate.email,
  });
}

export function InterviewList({ interviews, onEdit, onCancel, compact }: Props) {
  return (
    <div className="space-y-2">
      {interviews.map((it) => {
        const start = new Date(it.scheduledAt);
        const cancelled = it.status === "CANCELLED";
        const calendarUrl = calendarUrlFor(it);
        return (
          <Card key={it.id} className={cn(cancelled && "opacity-60")}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-4 min-w-0">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                    <span className="text-[10px] uppercase font-semibold">
                      {start.toLocaleString("en-US", { month: "short" })}
                    </span>
                    <span className="text-xl font-bold leading-none">{start.getDate()}</span>
                    <span className="text-[10px] tabular-nums">
                      {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/candidates/${it.candidate.id}`}
                        className="font-medium hover:underline"
                      >
                        {it.candidate.name}
                      </Link>
                      <Badge variant={STATUS_VARIANT[it.status] ?? "outline"}>
                        {it.status.toLowerCase()}
                      </Badge>
                      <Badge variant="outline">{TYPE_LABEL[it.type] ?? it.type}</Badge>
                      {it.candidate.screenings?.[0] ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <Sparkles className="h-3 w-3" />
                          AI score {it.candidate.screenings[0].overallScore.toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{it.candidate.job.title}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {formatDate(start, "datetime")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {it.durationMin} min
                      </span>
                      {it.candidate.email ? (
                        <span className="text-muted-foreground/80">→ {it.candidate.email}</span>
                      ) : null}
                    </div>

                    {it.description ? (
                      <p className="mt-2 text-sm leading-snug text-muted-foreground line-clamp-3 whitespace-pre-line">
                        {it.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                {!compact ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      asChild
                      title="Add to Google Calendar — Meet link is auto-attached on Save"
                      disabled={cancelled}
                    >
                      <a href={calendarUrl} target="_blank" rel="noreferrer">
                        <CalendarPlus className="h-4 w-4" />
                        <span className="hidden sm:inline">Add to Google Calendar</span>
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      title="Download .ics (Outlook / Apple Calendar)"
                    >
                      <a href={`/api/interviews/${it.id}/ics`}>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(it.id)}
                      disabled={cancelled}
                      title="Edit"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    {!cancelled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCancel(it.id)}
                        className="text-destructive hover:text-destructive"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="sm" asChild title="Open candidate">
                      <Link href={`/candidates/${it.candidate.id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
