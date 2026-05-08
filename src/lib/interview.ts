/**
 * Interview helpers — Google Calendar deep links, conflict detection,
 * and .ics file synthesis for download / email attachment.
 *
 * The "Add to Google Calendar" flow uses Google's public render URL
 * (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`),
 * which has been a stable Google interface for over a decade. It requires
 * NO OAuth, NO API keys, and NO Google Cloud project.
 *
 * Workflow:
 *   1. HR schedules in TalentTrack → row saved with a placeholder room id.
 *   2. HR clicks "Add to Google Calendar" → Google Calendar opens prefilled
 *      (title, time, attendees, description) in their own account.
 *   3. HR clicks Save → Google Calendar attaches a real Google Meet link
 *      automatically (Workspace default; one-click for personal accounts)
 *      and emails the candidate the invite.
 *
 * Why not the Calendar API directly? It would require OAuth (consent screen,
 * redirect URIs, refresh tokens) or a Service Account with domain-wide
 * delegation — way more deploy complexity for the same end result, since the
 * actual Meet room is still issued by Google either way.
 */
import { customAlphabet } from "nanoid";
import { createEvent, type EventAttributes } from "ics";

const roomSegment = customAlphabet("abcdefghijklmnopqrstuvwxyz", 4);

/**
 * Generate a placeholder reference id in Google Meet's `xxx-yyyy-zzz` format.
 * This is *not* a real Meet room — Google issues those server-side. It's used
 * only to give each interview a stable, copy-pasteable identifier inside the
 * .ics file. The real Meet link is created when HR saves the event in Google
 * Calendar.
 */
export function generateMeetRefId(): string {
  return `${roomSegment()}-${customAlphabet("abcdefghijklmnopqrstuvwxyz", 4)()}-${roomSegment()}`;
}

/** Backwards-compat alias — older callers used `generateMeetLink`. */
export function generateMeetLink(): string {
  return `https://meet.google.com/${generateMeetRefId()}`;
}

export interface GoogleCalendarLinkInput {
  title: string;
  description?: string;
  start: Date | string;
  durationMin: number;
  attendeeEmail?: string;
  location?: string;
}

/**
 * Format a Date into Google Calendar's expected `YYYYMMDDTHHmmssZ` (UTC).
 * No separators, trailing `Z` indicates UTC.
 */
function formatGCalDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Build an "Add to Google Calendar" deep link. When the user opens this URL
 * Google Calendar prefills a new event with the given details. On Save,
 * Google Calendar automatically attaches a real Google Meet conference
 * (default for Workspace; one click for personal accounts).
 *
 * Reference: https://support.google.com/calendar/thread/81344786
 */
export function buildGoogleCalendarUrl(input: GoogleCalendarLinkInput): string {
  const start = typeof input.start === "string" ? new Date(input.start) : input.start;
  const end = new Date(start.getTime() + input.durationMin * 60_000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${formatGCalDate(start)}/${formatGCalDate(end)}`,
  });
  if (input.description) params.set("details", input.description);
  if (input.location) params.set("location", input.location);
  if (input.attendeeEmail) params.set("add", input.attendeeEmail);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export interface InterviewSlot {
  id?: string;
  scheduledAt: Date | string;
  durationMin: number;
}

/** True if `a` and `b` overlap (touching edges do NOT count as conflict). */
export function overlaps(a: InterviewSlot, b: InterviewSlot): boolean {
  const aStart = new Date(a.scheduledAt).getTime();
  const aEnd = aStart + a.durationMin * 60_000;
  const bStart = new Date(b.scheduledAt).getTime();
  const bEnd = bStart + b.durationMin * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Find any existing interviews that conflict with `candidate`.
 * Pass `excludeId` when editing an existing interview so it doesn't conflict
 * with itself.
 */
export function findConflicts(
  candidate: InterviewSlot,
  existing: Array<InterviewSlot & { id: string; status?: string }>,
  excludeId?: string,
): Array<InterviewSlot & { id: string }> {
  return existing.filter((e) => {
    if (e.id === excludeId) return false;
    if (e.status === "CANCELLED") return false;
    return overlaps(candidate, e);
  });
}

export interface IcsInput {
  title: string;
  description: string;
  start: Date;
  durationMin: number;
  meetLink: string;
  organizerName?: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  uid?: string;
}

export function buildIcs(input: IcsInput): string {
  const start = input.start;
  const event: EventAttributes = {
    uid: input.uid,
    title: input.title,
    description: `${input.description}\n\nOpen in Google Calendar to add Meet link & email the candidate.`,
    start: [
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      start.getUTCDate(),
      start.getUTCHours(),
      start.getUTCMinutes(),
    ],
    startInputType: "utc",
    duration: { minutes: input.durationMin },
    location: input.meetLink,
    url: input.meetLink,
    status: "CONFIRMED",
    busyStatus: "BUSY",
    organizer: input.organizerEmail
      ? { name: input.organizerName ?? "TalentTrack HR", email: input.organizerEmail }
      : undefined,
    attendees: input.attendeeEmail
      ? [
          {
            name: input.attendeeName ?? "Candidate",
            email: input.attendeeEmail,
            rsvp: true,
            partstat: "NEEDS-ACTION",
            role: "REQ-PARTICIPANT",
          },
        ]
      : undefined,
  };

  const { error, value } = createEvent(event);
  if (error || !value) throw error ?? new Error("Failed to build .ics");
  return value;
}
