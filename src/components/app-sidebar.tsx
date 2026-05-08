"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileSearch, CalendarClock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, badge: "Module 4" },
  { href: "/candidates", label: "Candidates", icon: Users, badge: "Module 2" },
  { href: "/screen", label: "Resume Screener", icon: FileSearch, badge: "Module 1" },
  { href: "/interviews", label: "Interviews", icon: CalendarClock, badge: "Module 3" },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">TalentTrack</div>
          <div className="text-xs text-muted-foreground">Recruiting Pipeline</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wide",
                  active ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {item.badge}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 pb-16 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Tip</p>
        <p className="mt-1 leading-relaxed">
          Start by uploading a resume in <Link href="/screen" className="underline">Resume Screener</Link>{" "}
          to see Claude score and summarize candidates.
        </p>
      </div>
    </aside>
  );
}
