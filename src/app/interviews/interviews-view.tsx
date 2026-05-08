"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CalendarDays, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScheduleDialog } from "./schedule-dialog";
import { InterviewList } from "./interview-list";
import { CalendarView } from "./calendar-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { buildGoogleCalendarUrl } from "@/lib/interview";
import type { CandidateOption, InterviewWithCandidate } from "./types";

const TYPE_LABEL: Record<string, string> = {
  PRESCREEN: "Prescreen call",
  FIRST_INTERVIEW: "First interview",
  FINAL: "Final round",
};

interface Props {
  initialInterviews: InterviewWithCandidate[];
  candidates: CandidateOption[];
}

export function InterviewsView({ initialInterviews, candidates }: Props) {
  const router = useRouter();
  const [interviews, setInterviews] = useState<InterviewWithCandidate[]>(initialInterviews);
  const [showSchedule, setShowSchedule] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const upcoming = useMemo(
    () =>
      interviews
        .filter((i) => i.status === "SCHEDULED" && new Date(i.scheduledAt).getTime() >= Date.now() - 60 * 60 * 1000)
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [interviews],
  );

  const past = useMemo(
    () =>
      interviews
        .filter((i) => i.status !== "SCHEDULED" || new Date(i.scheduledAt).getTime() < Date.now() - 60 * 60 * 1000)
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [interviews],
  );

  function handleCreated(i: InterviewWithCandidate) {
    setInterviews((all) => [...all, i]);
    const calendarUrl = buildGoogleCalendarUrl({
      title: `${TYPE_LABEL[i.type] ?? "Interview"} — ${i.candidate.name}`,
      description: i.description ?? undefined,
      start: i.scheduledAt,
      durationMin: i.durationMin,
      attendeeEmail: i.candidate.email,
    });
    toast.success(`Interview scheduled for ${i.candidate.name}`, {
      description: "Open Google Calendar to attach a Meet link and email the candidate.",
      action: {
        label: "Open Calendar",
        onClick: () => window.open(calendarUrl, "_blank", "noopener,noreferrer"),
      },
      duration: 8000,
    });
    router.refresh();
  }

  function handleUpdated(i: InterviewWithCandidate) {
    setInterviews((all) => all.map((x) => (x.id === i.id ? i : x)));
    toast.success("Interview updated");
    router.refresh();
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this interview? The candidate's stage will be kept.")) return;
    try {
      const res = await fetch(`/api/interviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      handleUpdated(updated);
    } catch {
      toast.error("Couldn't cancel interview");
    }
  }

  const editing = editingId ? interviews.find((i) => i.id === editingId) ?? null : null;

  return (
    <Tabs defaultValue="upcoming" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
              {upcoming.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowSchedule(true);
          }}
          disabled={candidates.length === 0}
        >
          <Plus className="h-4 w-4" /> Schedule interview
        </Button>
      </div>

      {candidates.length === 0 && interviews.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No active candidates to schedule"
          description="Add candidates first (Module 2) — only candidates in active stages can be scheduled."
        />
      ) : (
        <>
          <TabsContent value="upcoming" className="mt-0 space-y-3">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming interviews"
                description="Schedule one to get started — we'll auto-generate a Meet link and warn about conflicts."
              />
            ) : (
              <InterviewList
                interviews={upcoming}
                onEdit={(id) => {
                  setEditingId(id);
                  setShowSchedule(true);
                }}
                onCancel={handleCancel}
              />
            )}
            <ConflictBanner interviews={upcoming} />
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <CalendarView
              interviews={upcoming}
              onSelect={(id) => {
                setEditingId(id);
                setShowSchedule(true);
              }}
            />
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            {past.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No past interviews"
                description="Completed and cancelled interviews will show up here."
              />
            ) : (
              <InterviewList interviews={past} onEdit={() => {}} onCancel={() => {}} compact />
            )}
          </TabsContent>
        </>
      )}

      <ScheduleDialog
        open={showSchedule}
        onOpenChange={(o) => {
          setShowSchedule(o);
          if (!o) setEditingId(null);
        }}
        candidates={candidates}
        editing={editing}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
      />
    </Tabs>
  );
}

/** Surface any internal overlap warning at a glance. */
function ConflictBanner({ interviews }: { interviews: InterviewWithCandidate[] }) {
  const overlaps: Array<{ a: InterviewWithCandidate; b: InterviewWithCandidate }> = [];
  for (let i = 0; i < interviews.length; i++) {
    for (let j = i + 1; j < interviews.length; j++) {
      const a = interviews[i];
      const b = interviews[j];
      const aStart = new Date(a.scheduledAt).getTime();
      const aEnd = aStart + a.durationMin * 60_000;
      const bStart = new Date(b.scheduledAt).getTime();
      const bEnd = bStart + b.durationMin * 60_000;
      if (aStart < bEnd && bStart < aEnd) overlaps.push({ a, b });
    }
  }
  if (overlaps.length === 0) return null;
  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          {overlaps.length} schedule conflict{overlaps.length > 1 ? "s" : ""} detected
        </CardTitle>
        <CardDescription className="text-amber-800">
          The following interviews overlap. Reschedule one of each pair to avoid double-booking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm text-amber-900">
        {overlaps.map((o, i) => (
          <div key={i}>
            • <strong>{o.a.candidate.name}</strong> overlaps with <strong>{o.b.candidate.name}</strong>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
