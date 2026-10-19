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

/** Split an app display name or email into first and last name for the Wix contact. */
export function contactName(full: string | null | undefined, email: string): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: email.split("@")[0], lastName: "(app)" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || "(app)" };
}

/** Which bookings go through Wix: 'on' = everyone, 'owner' = only the listed test emails, anything else = nobody. */
export function useWix(mode: string | null | undefined, testEmails: string[] | null | undefined, email: string): boolean {
  if (mode === "on") return true;
  if (mode === "owner") return (testEmails ?? []).map((e) => e.toLowerCase()).includes(email.toLowerCase());
  return false;
}
