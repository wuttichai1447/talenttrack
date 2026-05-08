import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Display timezone for all candidate / interview times.
 * Pinned to Asia/Bangkok so server-rendered (Vercel UTC) and client-rendered
 * times agree — otherwise an interview saved at 17:00 ICT would appear as
 * 10:00 in Server Components and 17:00 in Client Components.
 */
export const DISPLAY_TZ = "Asia/Bangkok";

export function formatDate(date: Date | string, format: "short" | "long" | "datetime" = "short") {
  const d = typeof date === "string" ? new Date(date) : date;
  if (format === "long") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: DISPLAY_TZ,
    });
  }
  if (format === "datetime") {
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: DISPLAY_TZ,
    });
  }
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: DISPLAY_TZ,
  });
}

export function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const intervals: [number, string][] = [
    [60 * 60 * 24 * 365, "y"],
    [60 * 60 * 24 * 30, "mo"],
    [60 * 60 * 24 * 7, "w"],
    [60 * 60 * 24, "d"],
    [60 * 60, "h"],
    [60, "m"],
  ];
  for (const [s, label] of intervals) {
    const v = Math.floor(seconds / s);
    if (v >= 1) return `${v}${label} ago`;
  }
  return "just now";
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Safe JSON parse with a fallback. */
export function safeJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
