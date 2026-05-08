"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGES, type StageId } from "@/lib/stages";
import { cn } from "@/lib/utils";

interface Props {
  candidate: { id: string; stage: string; name: string };
}

export function CandidateActions({ candidate }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<StageId>(candidate.stage as StageId);
  const [busy, setBusy] = useState(false);

  async function changeStage(next: StageId) {
    if (next === stage) return;
    const prev = stage;
    setStage(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Moved to ${STAGES.find((s) => s.id === next)?.label}`);
      router.refresh();
    } catch {
      setStage(prev);
      toast.error("Couldn't update stage");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCandidate() {
    if (!confirm(`Delete ${candidate.name}? This will also remove screenings and interviews.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Candidate deleted");
      router.push("/candidates");
    } catch {
      toast.error("Couldn't delete");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={stage} onValueChange={(v) => changeStage(v as StageId)} disabled={busy}>
        <SelectTrigger className={cn("w-[180px]")}>
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
      <Button variant="outline" size="icon" onClick={deleteCandidate} disabled={busy} className="text-destructive hover:text-destructive">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
