import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  CalendarDays,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  MessageSquareQuote,
  CalendarPlus,
  Plus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getStage } from "@/lib/stages";
import { buildGoogleCalendarUrl } from "@/lib/interview";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBar } from "@/components/ui/score-bar";
import { cn, formatDate, initials, safeJSON } from "@/lib/utils";
import { CandidateActions } from "./candidate-actions";

const INTERVIEW_TYPE_LABEL: Record<string, string> = {
  PRESCREEN: "Prescreen call",
  FIRST_INTERVIEW: "First interview",
  FINAL: "Final round",
};

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      job: true,
      screenings: { orderBy: { createdAt: "desc" } },
      interviews: { orderBy: { scheduledAt: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!candidate) notFound();

  const stage = getStage(candidate.stage);
  const latestScreening = candidate.screenings[0];

  return (
    <>
      <PageHeader
        badge="Candidate"
        title={candidate.name}
        description={candidate.email}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/candidates">
              <ArrowLeft className="h-4 w-4" /> Back to candidates
            </Link>
          </Button>
        }
      />
      <div className="p-6 space-y-6">
        {/* Quick info bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                  {initials(candidate.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{candidate.name}</h2>
                    <Badge className={cn(stage.color)}>{stage.label}</Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> {candidate.job.title}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {candidate.email}
                    </span>
                    {candidate.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {candidate.phone}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> applied {formatDate(candidate.appliedAt)}
                    </span>
                    <Badge variant="outline">{candidate.source}</Badge>
                  </div>
                </div>
              </div>
              <CandidateActions candidate={candidate} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT — main */}
          <div className="space-y-4 lg:col-span-2">
            {latestScreening ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Screening
                  </CardTitle>
                  <CardDescription>
                    Generated {formatDate(latestScreening.createdAt, "datetime")} · model{" "}
                    <code className="text-xs">{latestScreening.modelUsed}</code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[120px,1fr]">
                    <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-3">
                      <div
                        className={cn(
                          "text-3xl font-bold tabular-nums",
                          latestScreening.overallScore >= 7.5
                            ? "text-emerald-600"
                            : latestScreening.overallScore >= 5
                              ? "text-amber-600"
                              : "text-red-600",
                        )}
                      >
                        {latestScreening.overallScore.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">Overall</div>
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <ScoreBar label="Skills" value={latestScreening.skillsScore} />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {latestScreening.skillsReasoning}
                        </p>
                      </div>
                      <div>
                        <ScoreBar label="Experience" value={latestScreening.experienceScore} />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {latestScreening.experienceReasoning}
                        </p>
                      </div>
                      <div>
                        <ScoreBar label="Culture" value={latestScreening.cultureScore} />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {latestScreening.cultureReasoning}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Summary
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed">{latestScreening.summary}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <ListBlock
                      title="Strengths"
                      icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      items={safeJSON<string[]>(latestScreening.strengths, [])}
                      dotClass="bg-emerald-500"
                    />
                    <ListBlock
                      title="Concerns to probe"
                      icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                      items={safeJSON<string[]>(latestScreening.concerns, [])}
                      dotClass="bg-amber-500"
                    />
                  </div>

                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <MessageSquareQuote className="h-3.5 w-3.5" /> Prescreen-call questions
                    </h4>
                    <ul className="divide-y rounded-md border">
                      {safeJSON<Array<{ topic: string; question: string; why: string }>>(
                        latestScreening.prescreenQuestions,
                        [],
                      ).map((q, i) => (
                        <li key={i} className="p-3">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="shrink-0">
                              {q.topic}
                            </Badge>
                            <p className="text-sm font-medium">{q.question}</p>
                          </div>
                          <p className="mt-1 ml-[5.5rem] text-xs text-muted-foreground">
                            <span className="font-medium">Why:</span> {q.why}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Sparkles className="mb-2 h-6 w-6 text-muted-foreground" />
                  <h3 className="font-semibold">No AI screening yet</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Run the resume through the AI Screener to get scoring and tailored prescreen questions.
                  </p>
                  <Button className="mt-3" size="sm" asChild>
                    <Link href="/screen">Open Resume Screener</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Interviews */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Interviews</CardTitle>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/interviews">
                      <Plus className="h-3.5 w-3.5" /> Schedule
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {candidate.interviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No interviews scheduled yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {candidate.interviews.map((it) => {
                      const calendarUrl = buildGoogleCalendarUrl({
                        title: `${INTERVIEW_TYPE_LABEL[it.type] ?? "Interview"} — ${candidate.name}`,
                        description: it.description ?? undefined,
                        start: it.scheduledAt,
                        durationMin: it.durationMin,
                        attendeeEmail: candidate.email,
                      });
                      return (
                        <li
                          key={it.id}
                          className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {INTERVIEW_TYPE_LABEL[it.type] ?? "Interview"}
                              </span>
                              <Badge variant={it.status === "CANCELLED" ? "danger" : "default"}>
                                {it.status.toLowerCase()}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDate(it.scheduledAt, "datetime")} · {it.durationMin} min
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              asChild
                              size="sm"
                              disabled={it.status === "CANCELLED"}
                              title="Add to Google Calendar (Meet link auto-attached on Save)"
                            >
                              <a href={calendarUrl} target="_blank" rel="noreferrer">
                                <CalendarPlus className="h-3.5 w-3.5" /> Calendar
                              </a>
                            </Button>
                            <Button asChild size="sm" variant="ghost" title="Download .ics">
                              <a href={`/api/interviews/${it.id}/ics`}>.ics</a>
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT — sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Stage history</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-3 pl-4">
                  {candidate.events.map((e) => {
                    const to = getStage(e.toStage);
                    return (
                      <li key={e.id} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                            to.dot,
                          )}
                        />
                        <div className="text-sm">
                          {e.fromStage ? (
                            <>
                              <span className="text-muted-foreground">
                                {getStage(e.fromStage).label}
                              </span>
                              <span className="mx-1 text-muted-foreground">→</span>
                            </>
                          ) : null}
                          <span className="font-medium">{to.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(e.createdAt, "datetime")}
                          {e.note ? ` · ${e.note}` : ""}
                        </p>
                      </li>
                    );
                  })}
                </ol>
                <div className="absolute" />
              </CardContent>
            </Card>

            {candidate.notes ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{candidate.notes}</p>
                </CardContent>
              </Card>
            ) : null}

            {candidate.resumeText ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resume text</CardTitle>
                  {candidate.resumeFile ? (
                    <CardDescription>From {candidate.resumeFile}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {candidate.resumeText.slice(0, 4000)}
                    {candidate.resumeText.length > 4000 ? "\n…" : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function ListBlock({
  title,
  icon,
  items,
  dotClass,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  dotClass: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </h4>
      <ul className="space-y-1 text-sm">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
