// MY GYM London: pure matching logic for the Wix to app booking sync.
// No network and no database here, so it can be tested on its own with made-up data.
// Wix is the boss of these bookings: the app only mirrors CONFIRMED Wix bookings.
//   * a booking by a member with an app account becomes a normal app booking (source 'wix')
//   * a booking by anyone else is kept as an anonymous "other" booking (class, date and Wix id only, no name or email)
//     so the spaces left in the app always count EVERYONE who is booked

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const GYM = /gym access|open gym/i; // the open-gym service; everything else is a class

export type WixBooking = { id: string; startDate: string; serviceId: string; email: string | null };
export type ClassRow = { id: number; day_name: string; start_time: string; name: string; kind: string };
export type ExistingRow = { id: string; class_id: number; user_id: string; date: string; source: string; wix_booking_id: string | null };
export type ExistingOther = { wix_booking_id: string; date: string };
export type NewRow = { class_id: number; user_id: string; date: string; wix_booking_id: string };
export type OtherRow = { wix_booking_id: string; class_id: number; date: string };

/** London date (YYYY-MM-DD), time (HH:MM) and weekday name for an ISO instant. */
export function londonParts(iso: string): { date: string; time: string; day: string } {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(iso)).forEach((x) => { p[x.type] = x.value; });
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${String(+p.hour % 24).padStart(2, "0")}:${p.minute}`;
  return { date, time, day: DAYS[new Date(date + "T12:00:00Z").getUTCDay()] };
}

export type Plan = {
  add: NewRow[];            // member bookings to add to class_bookings
  remove: string[];         // class_bookings ids to delete
  otherAdd: OtherRow[];     // anonymous bookings to add
  otherRemove: string[];    // wix_booking_ids of anonymous bookings to delete
  counts: {
    fetched: number; noClass: number;
    members: number; noEmail: number; noMember: number;
    toAdd: number; alreadyThere: number; toRemove: number; removeBlocked: boolean;
    otherTotal: number; otherAdd: number; otherRemove: number; otherRemoveBlocked: boolean;
  };
};

/**
 * Compare confirmed Wix bookings with what the app already has.
 *  - bookings: CONFIRMED Wix bookings in the window
 *  - serviceNames: Wix service id to service name
 *  - classes: active app timetable rows
 *  - userByEmail: lowercase email to app user id
 *  - existing: app booking rows in the window (any source)
 *  - existingOther: anonymous booking rows in the window
 *  - windowFromDate: London date (YYYY-MM-DD); only rows on or after it can be removed
 */
export function planSync(input: {
  bookings: WixBooking[];
  serviceNames: Map<string, string>;
  classes: ClassRow[];
  userByEmail: Map<string, string>;
  existing: ExistingRow[];
  existingOther: ExistingOther[];
  windowFromDate: string;
  removeLimit?: number;
}): Plan {
  const { bookings, serviceNames, classes, userByEmail, existing, existingOther, windowFromDate } = input;
  const counts = {
    fetched: bookings.length, noClass: 0, members: 0, noEmail: 0, noMember: 0,
    toAdd: 0, alreadyThere: 0, toRemove: 0, removeBlocked: false,
    otherTotal: 0, otherAdd: 0, otherRemove: 0, otherRemoveBlocked: false,
  };

  const haveKey = new Set(existing.map((r) => `${r.class_id}|${r.user_id}|${r.date}`));
  const haveWixId = new Set(existing.map((r) => r.wix_booking_id).filter(Boolean) as string[]);
  const add: NewRow[] = [];
  const other: OtherRow[] = [];

  for (const b of bookings) {
    const name = (serviceNames.get(b.serviceId) ?? "").trim();
    const kind = GYM.test(name) ? "gym" : "class";
    const t = londonParts(b.startDate);
    const cls = classes.find((c) => c.kind === kind && c.day_name === t.day && c.start_time === t.time &&
      (kind === "gym" || c.name.trim().toLowerCase() === name.toLowerCase()));
    if (!cls) { counts.noClass++; continue; }

    const email = (b.email ?? "").trim().toLowerCase();
    const user = email ? userByEmail.get(email) : undefined;
    if (!user) {
      // not an app member (or no email): count the booking anonymously so spaces left are right
      if (email) counts.noMember++; else counts.noEmail++;
      other.push({ wix_booking_id: b.id, class_id: cls.id, date: t.date });
      continue;
    }
    counts.members++;
    const key = `${cls.id}|${user}|${t.date}`;
    if (haveWixId.has(b.id) || haveKey.has(key)) { counts.alreadyThere++; continue; }
    haveKey.add(key); haveWixId.add(b.id);
    add.push({ class_id: cls.id, user_id: user, date: t.date, wix_booking_id: b.id });
  }
  counts.toAdd = add.length;

  // member rows that came from Wix, are in the window, and are no longer confirmed in Wix
  const liveIds = new Set(bookings.map((b) => b.id));
  const wixRows = existing.filter((r) => r.source === "wix" && r.wix_booking_id && r.date >= windowFromDate);
  const gone = wixRows.filter((r) => !liveIds.has(r.wix_booking_id as string));
  const limit = input.removeLimit ?? Math.max(5, Math.ceil(wixRows.length / 2));
  counts.toRemove = gone.length;
  let remove: string[] = gone.map((r) => r.id);
  if (gone.length > limit) { counts.removeBlocked = true; remove = []; } // too many at once: change nothing and report

  // anonymous rows: add the new ones, remove the ones that are no longer in the list (cancelled, or the person joined as a member)
  counts.otherTotal = other.length;
  const haveOther = new Set(existingOther.map((r) => r.wix_booking_id));
  const otherAdd = other.filter((o) => !haveOther.has(o.wix_booking_id));
  const otherNow = new Set(other.map((o) => o.wix_booking_id));
  const otherGone = existingOther.filter((r) => r.date >= windowFromDate && !otherNow.has(r.wix_booking_id));
  const otherLimit = input.removeLimit ?? Math.max(5, Math.ceil(existingOther.length / 2));
  counts.otherAdd = otherAdd.length;
  counts.otherRemove = otherGone.length;
  let otherRemove: string[] = otherGone.map((r) => r.wix_booking_id);
  if (otherGone.length > otherLimit) { counts.otherRemoveBlocked = true; otherRemove = []; }

  return { add, remove, otherAdd, otherRemove, counts };
}
