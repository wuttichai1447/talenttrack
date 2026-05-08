"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InterviewWithCandidate } from "./types";

interface Props {
  interviews: InterviewWithCandidate[];
  onSelect: (id: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ interviews, onSelect }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null });
    for (let d = 1; d <= lastDay; d++) cells.push({ date: new Date(year, month, d) });
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);

  function eventsOn(date: Date) {
    return interviews.filter((it) => {
      const d = new Date(it.scheduledAt);
      return (
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
      );
    });
  }

  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const d = new Date();
                setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-xs text-muted-foreground">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-center font-medium uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
          {grid.map((cell, i) => {
            if (!cell.date) {
              return <div key={i} className="bg-muted/40 min-h-[88px]" />;
            }
            const events = eventsOn(cell.date);
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[88px] bg-card p-1.5 text-xs",
                  isToday(cell.date) && "bg-primary/5",
                )}
              >
                <div
                  className={cn(
                    "mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium",
                    isToday(cell.date) ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  {cell.date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e.id)}
                      className={cn(
                        "block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium",
                        e.status === "CANCELLED"
                          ? "bg-red-100 text-red-800 line-through"
                          : "bg-blue-100 text-blue-800 hover:bg-blue-200",
                      )}
                      title={`${e.candidate.name} — ${new Date(e.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
                    >
                      {new Date(e.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}{" "}
                      {e.candidate.name}
                    </button>
                  ))}
                  {events.length > 3 ? (
                    <div className="px-1.5 text-[10px] text-muted-foreground">
                      +{events.length - 3} more
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
