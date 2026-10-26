# MY GYM London: email library (53 emails)

Every email the back end sends, written once, in the website's look. Nothing here is live yet and nothing here is a secret.

## Files
- `templates.mjs`: the wording of every email (one definition each).
- `render.mjs`: turns a definition into subject, plain text and HTML. Pure code, safe to reuse inside an Edge Function.
- `html/` and `text/`: ready-made copies, with member-specific `{{variables}}` left in place.
- `catalog.json`: every email, who gets it, when, and the variables it needs.
- `sample.mjs`, `test.mjs`, `build.mjs`: sample values, 483 automatic checks, and the build.
- Look at them all: open `website-redesign/email-previews/index.html` (desktop, phone and plain text views).

Run the checks any time: `node supabase/email-templates/test.mjs`. Rebuild after editing: `node supabase/email-templates/build.mjs`.

## The look
Website style: red band with a slanted edge, small chip label, bold capital heading in Barlow Condensed, red-edged detail panel, button with a slanted end, dark footer with address and links. 600 px wide, table-based, renders in Gmail, Apple Mail and Outlook. Apple Mail and many phone apps show the Barlow heading; Gmail and Outlook fall back to Arial Narrow, which still looks tidy. The font file is served from the app site (see `netlify.toml`, fonts allowed cross-site).

## What Wix sends today and what replaces it (checked 2026-10-25 from the Wix automations)
| Wix email | Replaced by |
|---|---|
| Booking cancelled (to client) | `booking-cancelled`, `class-cancelled-by-gym` |
| Appointment pending confirmation | not needed: classes confirm automatically |
| Saved card charged for a booking | `payment-receipt` |
| Welcome new Pricing Plans customer | `subscription-started` (+ `welcome`) |
| Plan cancelled (to customer) | `membership-cancelled` |
| Plan expiring in 3 days / plan expired | `renewal-reminder` / `membership-ended` |
| Free trial ending in 3 days | `trial-ending` |
| Refer a friend after buying a plan | `refer-a-friend-prompt`, `referral-invite`, `referral-reward` |
| Someone booked (to the owner) | `admin-new-booking` |
| Session overbooked (to the owner) | `admin-overbooked` |
| Customer bought a plan (to the owner) | `admin-new-member` |
| Customer cancelled a plan (to the owner) | `admin-membership-cancelled` |
| Form submitted (push to the owner) | `admin-new-enquiry` |
| Email a form link to specific people | `health-form-due` covers the useful case |
| Wix booking reminders, order and invoice emails, sign-up and password emails | `class-reminder`, `payment-receipt`, `welcome`, the `auth-*` emails |
| Voicemail, WhatsApp, Wix Payments balance notices, online programs, digital downloads, store price updates | Not replaced: Wix-specific, outside the gym's needs. Wix Payments notices stop when payments move. |

Not checked: emails Wix sends outside its Automations list (sign-up verification, password reset, Bookings reminder settings, invoice wording). The `auth-*` and reminder emails cover them, but compare with the live Wix emails before switching Wix off.

## Decisions made with the owner (2026-10-26) and what is still open
Decided (all in `settings.mjs`, `render.mjs` and `../forms/forms.mjs`, and tested):
- Failed payment: first notice on day 0, retry on day 5 with a second reminder, final notice on day 14, membership paused on day 21.
- Class reminders: an email 2 hours before AND the phone alert.
- Replies to enquiries are promised within one working day.
- Optional emails on at launch: we-miss-you (30 days away), review request (after the 5th class), milestones (10, 50, 100). Missed-class note stays off.
- Sole trader: receipts simply say "MyGym London". Not VAT registered, so no VAT line.
- Cancellation and refund wording is copied from the live Terms: 1 week's notice before the next billing date, refund within 1 month of paying.
- Form data is deleted after 2 years (Kids Gym 1 year). Instagram and directions links are the real ones.
Google review link: set and checked (opens the gym's Google review page). Still open: a solicitor or accountant reading receipts, refund, marketing and Kids wording before launch.

## How they will be sent (next steps, not done yet)
- Member and gym emails: one send function (reuses the Resend setup from `send-booking-email`) calls `render()`.
- `class-reminder` and the failed-payment series need schedules; receipts and `payment-failed-*` need payments connected.
- Marketing emails need the consent tables (`../migration-forms-and-consent.sql`, not applied) and an unsubscribe link, as the law requires.
- Sign-in emails (`auth-*`): paste each `html/auth-*.html` into Supabase, Authentication, Emails (Reset password, Change email, Invite user, Magic link), and set the subject lines from `catalog.json`. The password-changed notice needs Supabase's "security notification" option. The owner does these pastes.
- The existing booking email (`../functions/send-booking-email/email.ts`) is unchanged and still live; `booking-confirmation` here is its replacement.

## Rules baked in (and tested)
UK English, no dashes, plain wording. Every email has a plain-text version, alt text, https links, and a one-line subject of 78 characters or fewer. Anything a member types is escaped. Marketing emails always carry an unsubscribe link and say why they were sent; service emails say they are sent even if marketing is switched off.
