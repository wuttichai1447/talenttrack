"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Sparkles, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SOURCES } from "@/lib/stages";
import { ScoreCard, type ScreeningResultDisplay } from "./score-card";

interface JobOption {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  description: string;
  requirements: string;
  niceToHave?: string | null;
}

interface Props {
  jobs: JobOption[];
}

export function ScreenForm({ jobs }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScreeningResultDisplay | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [savedCandidateId, setSavedCandidateId] = useState<string | null>(null);

  const [candidate, setCandidate] = useState({
    name: "",
    email: "",
    phone: "",
    source: "LinkedIn" as string,
    notes: "",
  });

  const selectedJob = jobs.find((j) => j.id === jobId);

  function reset() {
    setFile(null);
    setPasted("");
    setResult(null);
    setExtractedText("");
    setResumeFileName(null);
    setSavedCandidateId(null);
    setCandidate({ name: "", email: "", phone: "", source: "LinkedIn", notes: "" });
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleScreen() {
    if (!jobId) {
      toast.error("Pick a job first");
      return;
    }
    if (mode === "upload" && !file) {
      toast.error("Choose a PDF file");
      return;
    }
    if (mode === "paste" && pasted.trim().length < 50) {
      toast.error("Paste a longer resume (at least 50 chars)");
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("jobId", jobId);
      if (mode === "upload" && file) fd.set("file", file);
      if (mode === "paste") fd.set("resumeText", pasted);

      const res = await fetch("/api/screen", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Screening failed");
      }
      setResult(data.result);
      setExtractedText(data.resumeText ?? pasted);
      setResumeFileName(data.resumeFile ?? null);
      toast.success("Screening complete");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Screening failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveCandidate() {
    if (!result) return;
    if (!candidate.name || !candidate.email) {
      toast.error("Name and email are required to save");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          resumeText: extractedText,
          candidate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      setSavedCandidateId(data.candidate.id);
      toast.success(`Saved ${data.candidate.name} → Screening`);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save candidate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* LEFT: input form */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Screen a candidate</CardTitle>
          <CardDescription>
            We never store CVs without your confirmation — preview the score first, then optionally save the
            candidate to the pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Position to match</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                    {j.department ? ` — ${j.department}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedJob ? (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {selectedJob.description}
              </p>
            ) : null}
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "paste")}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="upload">
                <FileUp className="h-4 w-4 mr-1.5" /> Upload PDF
              </TabsTrigger>
              <TabsTrigger value="paste">
                <FileText className="h-4 w-4 mr-1.5" /> Paste text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-2">
              <label
                htmlFor="cv-file"
                className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-8 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <FileUp className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {file ? file.name : "Click to choose a PDF"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {file ? `${(file.size / 1024).toFixed(0)} KB` : "Up to 10 MB"}
                </span>
              </label>
              <input
                ref={fileInput}
                id="cv-file"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  <X className="h-3 w-3" /> Remove
                </Button>
              ) : null}
            </TabsContent>

            <TabsContent value="paste">
              <Textarea
                rows={9}
                placeholder="Paste candidate's resume content here…"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {pasted.length} chars · ~{Math.round(pasted.split(/\s+/).filter(Boolean).length)} words
              </p>
            </TabsContent>
          </Tabs>

          <Button
            onClick={handleScreen}
            disabled={submitting || !jobId}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {submitting ? "Asking Claude…" : "Run AI screening"}
          </Button>
        </CardContent>
      </Card>

      {/* RIGHT: results */}
      <div className="lg:col-span-3 space-y-4">
        {!result ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 rounded-full bg-primary/10 p-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">No screening yet</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Choose a job, upload or paste a resume, then click <span className="font-medium">Run AI screening</span>.
                Claude will score the candidate, surface concerns, and suggest prescreen-call questions tailored to their gaps.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ScoreCard result={result} jobTitle={selectedJob?.title ?? ""} />

            {/* Save to pipeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Save to pipeline</CardTitle>
                <CardDescription>
                  Persist the candidate at <Badge variant="secondary">Screening</Badge> stage with this AI assessment attached.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {savedCandidateId ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <span>✓ Candidate saved to pipeline.</span>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={`/candidates/${savedCandidateId}`}>Open candidate</a>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={reset}>
                        Screen another
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="cand-name">Full name</Label>
                      <Input
                        id="cand-name"
                        value={candidate.name}
                        onChange={(e) => setCandidate({ ...candidate, name: e.target.value })}
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cand-email">Email</Label>
                      <Input
                        id="cand-email"
                        type="email"
                        value={candidate.email}
                        onChange={(e) => setCandidate({ ...candidate, email: e.target.value })}
                        placeholder="jane@example.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cand-phone">Phone</Label>
                      <Input
                        id="cand-phone"
                        value={candidate.phone}
                        onChange={(e) => setCandidate({ ...candidate, phone: e.target.value })}
                        placeholder="+66 …"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Source</Label>
                      <Select
                        value={candidate.source}
                        onValueChange={(v) => setCandidate({ ...candidate, source: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button onClick={handleSaveCandidate} disabled={submitting}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save to pipeline
                      </Button>
                    </div>
                  </div>
                )}
                {resumeFileName ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Resume file: <span className="font-mono">{resumeFileName}</span>
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
