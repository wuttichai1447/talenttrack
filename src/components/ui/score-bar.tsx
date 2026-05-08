import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  value: number;
  max?: number;
  className?: string;
}

export function ScoreBar({ label, value, max = 10, className }: ScoreBarProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const color =
    value >= 7.5
      ? "bg-emerald-500"
      : value >= 5
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="text-foreground font-semibold">{value.toFixed(1)}</span> / {max}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
