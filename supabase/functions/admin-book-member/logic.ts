// MY GYM London: pure helpers for book-class (no network, no database, so they can be tested with made-up data).
export const GYM = /gym access|open gym/i; // the open-gym service; everything else is a class

export type WixSlot = {
  localStartDate?: string;
  totalCapacity?: number;
  remainingCapacity?: number;
  eventInfo?: { eventId?: string };
};

/** The Wix service id for an app timetable row: gym rows match the open-gym service, classes match by name. */
export function matchService(kind: string, className: string, services: { id: string; name: string }[]): string | null {
  const want = className.trim().toLowerCase();
  const hit = services.find((s) =>
    kind === "gym" ? GYM.test(s.name) : s.name.trim().toLowerCase() === want);
  return hit ? hit.id : null;
}

/** The Wix session that starts at exactly this London date and time (HH:MM), or null. */
export function findSlot(slots: WixSlot[], date: string, time: string): { eventId: string; remaining: number | null } | null {
  const prefix = `${date}T${time}`;
  const s = slots.find((x) => (x.localStartDate ?? "").startsWith(prefix) && x.eventInfo?.eventId);
  if (!s) return null;
  return { eventId: s.eventInfo!.eventId!, remaining: typeof s.remainingCapacity === "number" ? s.remainingCapacity : null };
}

/** Keep a name safe to send to Wix: no angle brackets, quotes or control characters, at most 40 characters. */
export function cleanName(s: string): string {
  return s.replace(/[<>"'`\\\u0000-\u001f\u007f]/g, "").trim().slice(0, 40);
}

/** Split an app display name or email into first and last name for the Wix contact (member-typed text, so it is cleaned). */
export function contactName(full: string | null | undefined, email: string): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  const first = cleanName(parts[0] ?? "") || cleanName(email.split("@")[0]) || "Member";
  const last = cleanName(parts.slice(1).join(" ")) || "(app)";
  return { firstName: first, lastName: last };
}

/** London calendar date (YYYY-MM-DD) for an instant, and date arithmetic on YYYY-MM-DD strings. */
export function londonDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
}
export function addDays(date: string, n: number): string {
  const t = new Date(date + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10);
}
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function weekdayName(date: string): string { return DAY_NAMES[new Date(date + "T12:00:00Z").getUTCDay()]; }

/** The same date and weekday rules the database enforces, checked BEFORE Wix is touched. Returns an error text or null. */
export function checkBookingDate(date: string, dayName: string, today: string, startTime?: string, nowHM?: string, kind?: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T12:00:00Z")) || addDays(date, 0) !== date) return "Invalid date";
  if (date < today) return "You can't book a past class";
  if (date > addDays(today, 60)) return "You can only book up to 60 days ahead";
  if (weekdayName(date) !== dayName) return "That class doesn't run on this date";
  // a class or gym hour that has already started (London time) can't be booked
  if (date === today && startTime && nowHM && startTime.slice(0, 5) <= nowHM) {
    return kind === "gym" ? "That hour has already started" : "That class has already started";
  }
  return null;
}

/** The London clock time (HH:MM, 24 hour) for an instant. */
export function londonHM(d: Date): string {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour12: false, hour: "2-digit", minute: "2-digit" })
    .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return String((+p.hour) % 24).padStart(2, "0") + ":" + p.minute;
}

/** Database rule messages (error code P0001) are written for members and are safe to show; anything else is not. */
export function memberSafeError(code: string | undefined, message: string | undefined): string {
  return code === "P0001" && message ? message : "Booking didn't go through. Please try again.";
}

export const MAX_UPCOMING = 30;        // most future bookings one member can hold at once
export const MIN_SECONDS_BETWEEN = 4;  // pause between two booking attempts by the same member

/** Which bookings go through Wix: 'on' = everyone, 'owner' = only the listed test emails, anything else = nobody. */
export function useWix(mode: string | null | undefined, testEmails: string[] | null | undefined, email: string): boolean {
  if (mode === "on") return true;
  if (mode === "owner") return (testEmails ?? []).map((e) => e.toLowerCase()).includes(email.toLowerCase());
  return false;
}
