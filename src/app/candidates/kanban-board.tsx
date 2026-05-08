"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Mail, Phone, CalendarDays, Sparkles, GripVertical } from "lucide-react";
import { STAGES, type StageId, getStage } from "@/lib/stages";
import { cn, initials, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { CandidateWithRelations } from "./types";

interface Props {
  candidates: CandidateWithRelations[];
  onStageChange: (id: string, stage: StageId) => void;
}

export function KanbanBoard({ candidates, onStageChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    const targetStage = STAGES.find((s) => s.id === overId)?.id;
    if (!targetStage) return;
    onStageChange(String(active.id), targetStage);
  }

  const active = candidates.find((c) => c.id === activeId) ?? null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto -mx-6 px-6">
        <div className="flex gap-4 pb-4 min-w-max">
          {STAGES.map((stage) => {
            const items = candidates.filter((c) => c.stage === stage.id);
            return (
              <Column key={stage.id} stageId={stage.id} count={items.length}>
                {items.map((c) => (
                  <CandidateCard key={c.id} candidate={c} />
                ))}
              </Column>
            );
          })}
        </div>
      </div>
      <DragOverlay>
        {active ? <CandidateCard candidate={active} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stageId,
  count,
  children,
}: {
  stageId: StageId;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  const stage = getStage(stageId);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
        isOver && "bg-accent ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", stage.dot)} />
          <span className="text-sm font-semibold">{stage.label}</span>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {count}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 p-2 min-h-[120px]">{children}</div>
    </div>
  );
}

function CandidateCard({
  candidate,
  dragging,
}: {
  candidate: CandidateWithRelations;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
  });
  const score = candidate.screenings[0]?.overallScore;

  return (
    <Link
      href={`/candidates/${candidate.id}`}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "block group rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow",
        (isDragging || dragging) && "opacity-60 ring-2 ring-primary/40 cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          {...listeners}
          {...attributes}
          onClick={(e) => e.preventDefault()}
          className="mt-0.5 -ml-1 cursor-grab opacity-0 group-hover:opacity-60 hover:opacity-100"
          aria-label="Drag candidate"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials(candidate.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{candidate.name}</p>
            {score !== undefined ? (
              <span
                className={cn(
                  "shrink-0 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                  score >= 7.5
                    ? "bg-emerald-50 text-emerald-700"
                    : score >= 5
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700",
                )}
                title="AI screening score"
              >
                <Sparkles className="h-2.5 w-2.5" />
                {score.toFixed(1)}
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">{candidate.job.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" /> {candidate.email}
            </span>
            {candidate.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {candidate.phone}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1" suppressHydrationWarning>
              <CalendarDays className="h-3 w-3" /> {timeAgo(candidate.appliedAt)}
            </span>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
              {candidate.source}
            </Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}
