/**
 * Pipeline stage definitions — single source of truth for ordering, labels, and
 * colors. Used by Kanban (Module 2), Scheduler (Module 3), and Dashboard (Module 4).
 */
export const STAGES = [
  {
    id: "APPLIED",
    label: "Applied",
    description: "New application received",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
  {
    id: "SCREENING",
    label: "Screening",
    description: "AI/HR resume review in progress",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  {
    id: "PRE_SCREEN_CALL",
    label: "Pre-screen Call",
    description: "Phone screen scheduled or completed",
    color: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  {
    id: "FIRST_INTERVIEW",
    label: "First Interview",
    description: "Technical / culture interview",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
  },
  {
    id: "OFFER",
    label: "Offer",
    description: "Offer extended",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    id: "HIRED",
    label: "Hired",
    description: "Offer accepted — onboarding",
    color: "bg-green-100 text-green-800 border-green-300",
    dot: "bg-green-600",
  },
  {
    id: "REJECTED",
    label: "Rejected",
    description: "Not moving forward",
    color: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const STAGE_IDS: StageId[] = STAGES.map((s) => s.id);

export function getStage(id: string) {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

export const ACTIVE_STAGES: StageId[] = [
  "APPLIED",
  "SCREENING",
  "PRE_SCREEN_CALL",
  "FIRST_INTERVIEW",
  "OFFER",
];

export const TERMINAL_STAGES: StageId[] = ["HIRED", "REJECTED"];

export const SOURCES = [
  "LinkedIn",
  "JobsDB",
  "Referral",
  "Indeed",
  "Company Website",
  "Other",
] as const;
export type Source = (typeof SOURCES)[number];
