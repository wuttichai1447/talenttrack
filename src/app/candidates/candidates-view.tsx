"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, KanbanSquare, List, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { STAGES, SOURCES, type StageId } from "@/lib/stages";
import type { Candidate, Job } from "@prisma/client";
import type { CandidateWithRelations } from "./types";
import { KanbanBoard } from "./kanban-board";
import { CandidateList } from "./candidate-list";
import { NewCandidateDialog } from "./new-candidate-dialog";

interface Props {
  initialCandidates: CandidateWithRelations[];
  jobs: Job[];
}

export function CandidatesView({ initialCandidates, jobs }: Props) {
  const router = useRouter();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (jobFilter !== "all" && c.jobId !== jobFilter) return false;
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [candidates, search, stageFilter, jobFilter, sourceFilter]);

  async function handleStageChange(candidateId: string, newStage: StageId) {
    const prev = candidates.find((c) => c.id === candidateId);
    if (!prev || prev.stage === newStage) return;

    setCandidates((cs) =>
      cs.map((c) => (c.id === candidateId ? { ...c, stage: newStage } : c)),
    );

    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      toast.success(
        `Moved ${prev.name} → ${STAGES.find((s) => s.id === newStage)?.label}`,
      );
      router.refresh();
    } catch {
      setCandidates((cs) =>
        cs.map((c) => (c.id === candidateId ? { ...c, stage: prev.stage } : c)),
      );
      toast.error("Couldn't update stage. Reverted.");
    }
  }

  function handleCreated(c: Candidate & { job: Pick<Job, "id" | "title"> }) {
    setCandidates((cs) => [
      {
        ...c,
        screenings: [],
        _count: { interviews: 0 },
      } as CandidateWithRelations,
      ...cs,
    ]);
    toast.success(`${c.name} added`);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const prev = candidates;
    setCandidates((cs) => cs.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/candidates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Candidate deleted");
      router.refresh();
    } catch {
      setCandidates(prev);
      toast.error("Couldn't delete");
    }
  }

  const hasJobs = jobs.length > 0;

  return (
    <Tabs defaultValue="kanban" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All positions" />
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
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <TabsList>
            <TabsTrigger value="kanban">
              <KanbanSquare className="h-4 w-4 mr-1.5" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="h-4 w-4 mr-1.5" /> List
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => setShowNew(true)} disabled={!hasJobs}>
            <Plus className="h-4 w-4" /> Add candidate
          </Button>
        </div>
      </div>

      {!hasJobs ? (
        <EmptyState
          icon={Users}
          title="No job postings yet"
          description="Create a job from the database seed (`npm run db:seed`) before adding candidates."
        />
      ) : filtered.length === 0 && candidates.length > 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try clearing filters or changing the search query."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStageFilter("all");
                setJobFilter("all");
                setSourceFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates yet"
          description="Add a candidate manually, or use the Resume Screener to upload and auto-create one."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4" /> Add candidate
              </Button>
              <Button variant="outline" asChild>
                <Link href="/screen">Open Resume Screener</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <TabsContent value="kanban" className="mt-0">
            <KanbanBoard
              candidates={filtered}
              onStageChange={handleStageChange}
            />
          </TabsContent>
          <TabsContent value="list" className="mt-0">
            <CandidateList
              candidates={filtered}
              onStageChange={handleStageChange}
              onDelete={handleDelete}
            />
          </TabsContent>
        </>
      )}

      <NewCandidateDialog
        open={showNew}
        onOpenChange={setShowNew}
        jobs={jobs}
        onCreated={handleCreated}
      />
    </Tabs>
  );
}
