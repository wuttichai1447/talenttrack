"use client";

import Link from "next/link";
import { Mail, Phone, Sparkles, Trash2 } from "lucide-react";
import { STAGES, getStage, type StageId } from "@/lib/stages";
import { cn, formatDate, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CandidateWithRelations } from "./types";

interface Props {
  candidates: CandidateWithRelations[];
  onStageChange: (id: string, stage: StageId) => void;
  onDelete: (id: string) => void;
}

export function CandidateList({ candidates, onStageChange, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Candidate</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">Position</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Source</th>
            <th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">Score</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Applied</th>
            <th className="px-4 py-3 font-medium w-10" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {candidates.map((c) => {
            const stage = getStage(c.stage);
            const score = c.screenings[0]?.overallScore;
            return (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/candidates/${c.id}`} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                        {c.phone ? (
                          <>
                            <span className="mx-1">·</span>
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                  {c.job.title}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <Badge variant="outline">{c.source}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={c.stage}
                    onValueChange={(v) => onStageChange(c.id, v as StageId)}
                  >
                    <SelectTrigger className={cn("w-[150px] h-8 text-xs", stage.color)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {score !== undefined ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                        score >= 7.5
                          ? "bg-emerald-50 text-emerald-700"
                          : score >= 5
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700",
                      )}
                    >
                      <Sparkles className="h-3 w-3" />
                      {score.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                  {formatDate(c.appliedAt)}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete ${c.name}?`)) onDelete(c.id);
                    }}
                    aria-label="Delete candidate"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
