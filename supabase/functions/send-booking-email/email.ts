// MY GYM London: the booking confirmation email (subject, plain text and HTML).
// Pure functions with no network calls, so they can be tested on their own.
// Times are London time. Plain transactional email: no marketing, no images.

export const GYM_ADDRESS = "MY GYM London, Main Avenue, Bush Hill Park, Enfield EN1 1DS";
export const APP_URL = "https://app.mygymlondon.co.uk/";
export const CANCEL_MINUTES = 10;

export type Booking = { id: string; date: string }; // date is 'YYYY-MM-DD'
export type ClassRow = { name: string; start_time: string; kind: string; coach?: string | null };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 'Friday 16 October' for a 'YYYY-MM-DD' date (the weekday does not depend on the time zone). */
export function prettyDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    .format(new Date(date + "T12:00:00Z"));
}

export function firstName(fullName: string | null | undefined): string {
  const n = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  return n;
}

export function buildEmail(b: Booking, c: ClassRow, fullName?: string | null) {
  const gym = c.kind === "gym";
  const what = gym ? "Gym session" : c.name;
  const when = prettyDate(b.date) + " at " + c.start_time;
  const hi = firstName(fullName) ? "Hi " + firstName(fullName) + "," : "Hi,";
  const subject = "You're booked: " + what + ", " + when;

  const coachLine = c.coach && !gym ? "Coach: " + c.coach : null;
  const text = [
    hi,
    "",
    "Your booking is confirmed.",
    "",
    (gym ? "Session: " : "Class: ") + what,
    "When: " + when + " (UK time)",
    coachLine,
    "Where: " + GYM_ADDRESS,
    "",
    "Need to cancel? You can cancel up to " + CANCEL_MINUTES + " minutes before it starts. Open the app, go to Bookings and tap Cancel:",
    APP_URL + "#bookings",
    "",
    "See you there,",
    "MY GYM London",
    "",
    "Questions? Reply to this email or write to info@mygymlondon.co.uk.",
    "This is a booking confirmation for your MY GYM London account.",
  ].filter((l) => l !== null).join("\n");

  const row = (k: string, v: string) =>
    `<tr><td style="padding:4px 14px 4px 0;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:520px;margin:0 auto;padding:20px">
<div style="background:#ffffff;border-radius:10px;padding:24px">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:1px;color:#c8322d;font-weight:700">MY GYM LONDON</p>
<h1 style="margin:0 0 14px;font-size:22px">Your booking is confirmed</h1>
<p style="margin:0 0 14px">${esc(hi)}</p>
<table style="border-collapse:collapse;font-size:15px;margin:0 0 16px">
${row(gym ? "Session" : "Class", what)}
${row("When", when + " (UK time)")}
${c.coach && !gym ? row("Coach", c.coach) : ""}
${row("Where", GYM_ADDRESS)}
</table>
<p style="margin:0 0 16px;font-size:14px;line-height:1.5">Need to cancel? You can cancel up to ${CANCEL_MINUTES} minutes before it starts. Open the app, go to Bookings and tap Cancel.</p>
<p style="margin:0 0 18px"><a href="${APP_URL}#bookings" style="display:inline-block;background:#e23a36;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px">View my bookings</a></p>
<p style="margin:0;font-size:13px;color:#666;line-height:1.5">Questions? Reply to this email or write to info@mygymlondon.co.uk.<br>This is a booking confirmation for your MY GYM London account.</p>
</div></div></body></html>`;

  return { subject, text, html };
}
