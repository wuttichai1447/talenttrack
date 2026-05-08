import Link from "next/link";
import { Users, FileSearch, CalendarClock, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/dashboard";
import { getStage } from "@/lib/stages";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDate } from "@/lib/utils";
import { AIReportCard } from "./ai-report-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [candidates, interviews, jobs] = await Promise.all([
    prisma.candidate.findMany({
      include: {
        job: { select: { id: true, title: true } },
        events: { select: { fromStage: true, toStage: true, createdAt: true } },
        screenings: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { overallScore: true, createdAt: true },
        },
      },
    }),
    prisma.interview.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: {
        candidate: { select: { id: true, name: true, email: true, job: { select: { title: true } } } },
      },
    }),
    prisma.job.findMany(),
  ]);

  const stats = computeStats(candidates, interviews);
  const upcomingInterviews = interviews.filter((i) => new Date(i.scheduledAt).getTime() >= Date.now() - 60 * 60 * 1000);

  return (
    <>
      <PageHeader
        badge="Module 4"
        title="Pipeline Dashboard"
        description="At-a-glance health of your recruiting pipeline. Generate an AI-written summary report for your weekly hiring sync."
      />
      <div className="p-6 space-y-6">
        {candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No candidates yet"
            description="Seed the database (`npm run db:seed`) or add a candidate to start seeing pipeline analytics here."
            action={
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/screen">
                    <FileSearch className="h-4 w-4" /> Open Resume Screener
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/candidates">
                    <Users className="h-4 w-4" /> Add candidate manually
                  </Link>
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {/* TOP STATS */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total candidates"
                value={stats.totalCandidates}
                hint={`${stats.activeCandidates} active`}
                icon={<Users className="h-4 w-4" />}
              />
              <StatCard
                label="Avg AI score"
                value={stats.avgAiScore !== null ? stats.avgAiScore.toFixed(1) : "—"}
                hint={`${stats.scoreBuckets.strong} strong fits`}
                icon={<Sparkles className="h-4 w-4" />}
              />
              <StatCard
                label="Hire rate"
                value={`${(stats.hireRate * 100).toFixed(0)}%`}
                hint={`${stats.hired} hired · ${stats.rejected} rejected`}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <StatCard
                label="Upcoming interviews"
                value={stats.upcomingInterviews}
                hint={
                  stats.avgTimeInStageDays !== null
                    ? `${stats.avgTimeInStageDays.toFixed(1)}d avg in stage`
                    : "—"
                }
                icon={<CalendarClock className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Funnel */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Pipeline funnel</CardTitle>
                  <CardDescription>
                    Distribution of candidates across stages.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {stats.funnel.map((row) => {
                    const stage = getStage(row.stage);
                    return (
                      <div key={row.stage}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-full", stage.dot)} />
                            <span className="font-medium">{row.label}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">
                            {row.count}
                            <span className="ml-1 text-xs">({(row.pct * 100).toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${row.pct * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {stats.byStage.REJECTED ? (
                    <div className="pt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-red-600">{stats.byStage.REJECTED} rejected</span> (excluded from funnel)
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Sources */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sources</CardTitle>
                  <CardDescription>Where candidates come from.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stats.bySource.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sources tracked yet.</p>
                  ) : (
                    stats.bySource.map((s) => {
                      const pct = stats.totalCandidates > 0 ? s.count / stats.totalCandidates : 0;
                      return (
                        <div key={s.source}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{s.source}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {s.count} <span className="text-xs">({(pct * 100).toFixed(0)}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{ width: `${pct * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            {/* AI Report + Upcoming Interviews */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AIReportCard jobs={jobs} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" /> Upcoming interviews
                  </CardTitle>
                  <CardDescription>Next 5 scheduled interviews.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {upcomingInterviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming interviews.</p>
                  ) : (
                    upcomingInterviews.map((i) => (
                      <Link
                        key={i.id}
                        href={`/candidates/${i.candidate.id}`}
                        className="flex items-center justify-between rounded-md p-2 hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{i.candidate.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(i.scheduledAt, "datetime")} · {i.candidate.job.title}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))
                  )}
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/interviews">View all</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Score distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI score distribution</CardTitle>
                <CardDescription>How candidates have scored on Claude&apos;s screening.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <ScoreBucket label="Strong (≥7.5)" count={stats.scoreBuckets.strong} variant="success" />
                  <ScoreBucket label="Mixed (5–7.5)" count={stats.scoreBuckets.mixed} variant="warn" />
                  <ScoreBucket label="Weak (<5)" count={stats.scoreBuckets.weak} variant="danger" />
                  <ScoreBucket label="Unscored" count={stats.scoreBuckets.unscored} variant="secondary" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function ScoreBucket({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "success" | "warn" | "danger" | "secondary";
}) {
  const styles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    secondary: "bg-muted text-muted-foreground border-border",
  };
  return (
    <div className={cn("rounded-md border p-3", styles[variant])}>
      <div className="text-2xl font-bold tabular-nums">{count}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
