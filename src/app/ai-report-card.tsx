"use client";

import { useState } from "react";
import { Sparkles, Loader2, Copy, Lightbulb, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job } from "@prisma/client";
import type { PipelineReport } from "@/lib/ai-report";

interface Props {
  jobs: Job[];
}

export function AIReportCard({ jobs }: Props) {
  const [scope, setScope] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PipelineReport | null>(null);

  async function generate() {
    setLoading(true);
    setReport(null);
    try {
      const url = scope === "all" ? "/api/report" : `/api/report?jobId=${scope}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Report failed");
      setReport(data.report);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  function copyReport() {
    if (!report) return;
    const text = [
      `${report.headline}`,
      "",
      report.summary,
      "",
      "Key insights:",
      ...report.insights.map((i, n) => `${n + 1}. ${i}`),
      "",
      "Recommended actions:",
      ...report.recommendations.map((r, n) => `${n + 1}. ${r.action}\n   Why: ${r.rationale}`),
      "",
      `Confidence: ${report.confidence}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Report copied to clipboard");
  }

  const confidenceVariant =
    report?.confidence === "high" ? "success" : report?.confidence === "medium" ? "warn" : "secondary";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Pipeline Report
            </CardTitle>
            <CardDescription>
              Auto-written executive summary + actionable recommendations for your weekly hiring sync.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All positions</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={generate} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Generating…" : report ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!report && !loading ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Click <span className="font-medium">Generate</span> to ask Claude for a written summary based on the live pipeline data above.
          </p>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Asking Claude…
          </div>
        ) : null}
        {report ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{report.headline}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant={confidenceVariant}>{report.confidence} confidence</Badge>
                  <Button variant="ghost" size="sm" onClick={copyReport}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5" /> Key insights
                </h4>
                <ul className="space-y-1.5 text-sm">
                  {report.insights.map((i, n) => (
                    <li key={n} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" /> Recommendations
                </h4>
                <ul className="space-y-2 text-sm">
                  {report.recommendations.map((r, n) => (
                    <li key={n} className="rounded-md border bg-muted/30 p-2">
                      <div className="font-medium">{r.action}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{r.rationale}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
