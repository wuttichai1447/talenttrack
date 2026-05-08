"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { safeJSON } from "@/lib/utils";
import type { CandidateOption, InterviewWithCandidate } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidates: CandidateOption[];
  editing: InterviewWithCandidate | null;
  onCreated: (i: InterviewWithCandidate) => void;
  onUpdated: (i: InterviewWithCandidate) => void;
}

interface ConflictDetail {
  id: string;
  candidateName: string;
  scheduledAt: string;
  durationMin: number;
}

function isoLocalNow(offsetHours = 1): string {
  const d = new Date();
  d.setHours(d.getHours() + offsetHours, 0, 0, 0);
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function ScheduleDialog({
  open,
  onOpenChange,
  candidates,
  editing,
  onCreated,
  onUpdated,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [candidateId, setCandidateId] = useState(editing?.candidateId ?? candidates[0]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    editing
      ? new Date(editing.scheduledAt).toISOString().slice(0, 16)
      : isoLocalNow(1),
  );
  const [durationMin, setDurationMin] = useState(editing?.durationMin ?? 30);
  const [type, setType] = useState(editing?.type ?? "PRESCREEN");
  const [interviewers, setInterviewers] = useState(editing?.interviewers ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);

  useEffect(() => {
    if (open) {
      setCandidateId(editing?.candidateId ?? candidates[0]?.id ?? "");
      setScheduledAt(
        editing
          ? new Date(editing.scheduledAt).toISOString().slice(0, 16)
          : isoLocalNow(1),
      );
      setDurationMin(editing?.durationMin ?? 30);
      setType(editing?.type ?? "PRESCREEN");
      setInterviewers(editing?.interviewers ?? "");
      setDescription(editing?.description ?? "");
      setConflicts([]);
    }
  }, [open, editing, candidates]);

  const candidate = useMemo(
    () => candidates.find((c) => c.id === candidateId) ?? null,
    [candidates, candidateId],
  );

  function autoFillFromAI() {
    if (!candidate?.screenings[0]) {
      toast.info("No AI screening on this candidate yet — run the Resume Screener first.");
      return;
    }
    const s = candidate.screenings[0];
    const questions = safeJSON<Array<{ topic: string; question: string; why: string }>>(
      s.prescreenQuestions,
      [],
    );
    const text = [
      `Candidate: ${candidate.name} (${candidate.job.title})`,
      "",
      "AI Screening Summary:",
      s.summary,
      "",
      "Suggested questions to cover:",
      ...questions.map((q, i) => `${i + 1}. [${q.topic}] ${q.question}`),
    ].join("\n");
    setDescription(text);
    toast.success("Filled from AI screening");
  }

  async function submit(opts: { ignoreConflicts?: boolean } = {}) {
    setSubmitting(true);
    setConflicts([]);
    try {
      const url = editing ? `/api/interviews/${editing.id}` : "/api/interviews";
      const method = editing ? "PATCH" : "POST";
      const body = {
        candidateId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMin: Number(durationMin),
        type,
        description,
        interviewers,
        ignoreConflicts: opts.ignoreConflicts ?? false,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 409 && data.conflict) {
        setConflicts(data.conflicts as ConflictDetail[]);
        return;
      }
      if (!res.ok) throw new Error(data?.error?.formErrors?.[0] ?? "Failed to save");

      if (editing) onUpdated(data);
      else onCreated(data);
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit interview" : "Schedule interview"}</DialogTitle>
          <DialogDescription>
            Save here, then click <span className="font-medium">Add to Google Calendar</span> to
            push the event into your Google account — Google will attach a real Meet link and email
            the candidate. We&apos;ll warn you about conflicts before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Candidate</Label>
            <Select value={candidateId} onValueChange={setCandidateId} disabled={!!editing}>
              <SelectTrigger>
                <SelectValue placeholder="Choose candidate" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidate?.screenings[0] ? (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI score: {candidate.screenings[0].overallScore.toFixed(1)} — click <span className="font-medium">Fill from AI</span> to import questions.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="when">Date & time</Label>
              <Input
                id="when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={String(durationMin)} onValueChange={(v) => setDurationMin(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESCREEN">Prescreen call</SelectItem>
                  <SelectItem value="FIRST_INTERVIEW">First interview</SelectItem>
                  <SelectItem value="FINAL">Final round</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interviewers">Interviewers</Label>
              <Input
                id="interviewers"
                placeholder="e.g. Khun Pim, Khun Top"
                value={interviewers ?? ""}
                onChange={(e) => setInterviewers(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="desc">Description / questions to ask</Label>
              <Button type="button" variant="ghost" size="sm" onClick={autoFillFromAI}>
                <Wand2 className="h-3.5 w-3.5" /> Fill from AI
              </Button>
            </div>
            <Textarea
              id="desc"
              rows={6}
              placeholder="Notes for the interviewer + questions to cover (auto-filled from AI screening if available)…"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {conflicts.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Conflict with {conflicts.length} existing interview
                {conflicts.length > 1 ? "s" : ""}
              </div>
              <ul className="mt-1.5 space-y-1 text-amber-900">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    • <strong>{c.candidateName}</strong> at{" "}
                    {new Date(c.scheduledAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    ({c.durationMin} min)
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-800">
                Pick a different time, or override and save anyway.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {conflicts.length > 0 ? (
            <Button
              variant="destructive"
              onClick={() => submit({ ignoreConflicts: true })}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save anyway
            </Button>
          ) : null}
          <Button onClick={() => submit()} disabled={submitting || !candidateId}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editing ? "Update" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
