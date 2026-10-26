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

## To confirm (business or legal decisions I must not guess)
1. Legal business name and VAT status for receipts (`business_legal_name`, `vat_line` in `render.mjs`).
2. Failed-payment schedule: first notice day 0, second day 3, final day 10, then pause? (`payment-failed-1/2/final`).
3. Pause rules, cancellation notice period and refund wording (`cancellation_terms`, `refund_timing`).
4. Reminder time (2 hours before) and whether reminders go by email, push, or both (push exists today).
5. Which emails to switch on at launch (`missed-class` is optional; marketing emails need consent first).
6. Instagram, Google review and directions links (placeholders in `render.mjs` and `sample.mjs`).
7. Data retention per form (default 2 years, Kids 1 year): see `../forms/forms.mjs`.
A solicitor or accountant should read receipts, refund and marketing wording before launch.

## How they will be sent (next steps, not done yet)
- Member and gym emails: one send function (reuses the Resend setup from `send-booking-email`) calls `render()`.
- `class-reminder` and the failed-payment series need schedules; receipts and `payment-failed-*` need payments connected.
- Marketing emails need the consent tables (`../migration-forms-and-consent.sql`, not applied) and an unsubscribe link, as the law requires.
- Sign-in emails (`auth-*`): paste each `html/auth-*.html` into Supabase, Authentication, Emails (Reset password, Change email, Invite user, Magic link), and set the subject lines from `catalog.json`. The password-changed notice needs Supabase's "security notification" option. The owner does these pastes.
- The existing booking email (`../functions/send-booking-email/email.ts`) is unchanged and still live; `booking-confirmation` here is its replacement.

## Rules baked in (and tested)
UK English, no dashes, plain wording. Every email has a plain-text version, alt text, https links, and a one-line subject of 78 characters or fewer. Anything a member types is escaped. Marketing emails always carry an unsubscribe link and say why they were sent; service emails say they are sent even if marketing is switched off.
