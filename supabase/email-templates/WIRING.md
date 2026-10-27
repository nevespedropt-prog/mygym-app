# Which action sends which email (status 2026-10-27)

"Built and tested" means the code exists and passes tests with a fake database and fake mail service. Nothing is live until the owner runs the SQL, adds the secrets and deploys the functions (steps at the bottom). "Not built" means no code yet.

| Visitor or member does this | Email(s) | Status |
|---|---|---|
| Sends the contact form | `admin-new-enquiry` to the gym, `enquiry-autoreply` to them | Built and tested (`submit-form`) |
| Sends the PT enquiry | `admin-new-enquiry`, `pt-enquiry-autoreply` | Built and tested |
| Books a free trial | `admin-new-enquiry`, `enquiry-autoreply` | Built and tested. `trial-confirmation` is sent when the gym confirms (needs the back end button) |
| Claims an offer on a landing page | `admin-new-enquiry`, `offer-autoreply` | Built and tested |
| Sends the corporate enquiry | `admin-new-enquiry`, `corporate-autoreply` | Built and tested |
| Registers a child for Kids Gym | `admin-new-enquiry`, `kids-registration-received` | Built and tested |
| Asks to pause or cancel (app) | `admin-change-request` | Built and tested |
| Rates a class 3 or lower (app) | `admin-new-review` | Built and tested. 4 and 5 see the Google review nudge instead |
| Invites a friend (app) | `referral-invite` to the friend | Built and tested |
| Signs up to the newsletter | `newsletter-welcome` (confirm link), then nothing until they confirm | Built and tested (`submit-form`, `marketing-consent`, `email.html`) |
| Clicks confirm or unsubscribe in an email | Records it | Built and tested (needs deploy) |
| Creates an app account | `welcome` | SQL hook written and dry-run tested (`migration-email-hooks.sql`) |
| Books a class in the app | `booking-confirmation` | LIVE (2026-10-26). SQL trigger, `migration-email-hook-booking.sql`. Wix bookings skipped |
| Cancels a booking in the app | `booking-cancelled` | LIVE. `book-class` v8 sends it after a successful cancel |
| Gym cancels a class | `class-cancelled-by-gym` to everyone booked | Function `admin-class-cancelled` LIVE (admin only). Page `admin-notify.html` ready, needs a push. It only emails: cancel the session in Wix afterwards |
| Class is 2 hours away | `class-reminder` (email) plus the phone alert | Email LIVE: database schedule every 5 minutes, `migration-email-hook-class-reminder.sql`. The phone alert stays at 1 hour before (unchanged). Real run PASSED 2026-10-27 (booking 18:00, reminder sent 15:55:03, no duplicate) |
| Joins a waiting list, gets a place | `waitlist-joined`, `waitlist-booked` | Not built (no waiting list in the app yet) |
| Buys or changes a plan, payment taken or failed, pause, cancel, refund | `subscription-started`, `payment-receipt`, `payment-failed-*`, `plan-changed`, `membership-*`, `refund-issued`, `renewal-reminder`, `card-expiring`, `trial-ending` | Not built. Payments stay on Wix until later, so these need Wix webhooks or the later payment move |
| Quiet for 30 days, 5th class, 10 / 50 / 100 classes | `we-miss-you`, `review-request`, `milestone` | LIVE (2026-10-26): database schedule daily 09:30 UTC, `migration-email-hook-engagement.sql`. Only members with confirmed marketing consent; nobody is emailed until the app/sign-up collects it. Selection logic checked 2026-10-27 with rolled-back dry runs (5th, 10th class, 30 days, withdrawn consent); no real run yet, nobody qualifies. |
| Leaves an enquiry unanswered 2 and 7 days | `lead-followup-1`, `lead-followup-2` | LIVE and tested for real (2026-10-26): daily 10:00 UTC, `migration-email-hook-leads.sql`. Only enquiries whose person ticked the marketing box; stops when marked joined / not now / spam or an app account exists. Also sends `refer-a-friend-prompt` 3 to 5 days after a member with consent joins |
| Gym sends a campaign | `newsletter` | Function `admin-campaign` + page `admin-campaign.html` built and tested (needs deploy + push). Test-to-yourself first; only confirmed subscribers; batches; no double sends |
| Resets password, changes email, invited, magic link, password changed | `auth-*` | Owner pastes the HTML into Supabase, Authentication, Emails |

## To make the built parts live (owner steps, in order)
1. SQL: run `migration-forms-and-consent.sql`, then `migration-email-hooks.sql` (new query each time, check the tab text).
2. Secrets in Supabase, Edge Functions, Secrets: `EMAIL_TOKEN_SECRET` (any long random text, 32+ characters) and confirm `RESEND_API_KEY` and `CRON_SECRET` exist.
3. Deploy `submit-form` (Verify JWT off), `marketing-consent` (Verify JWT off) and `send-email` (Verify JWT off). Each folder has its own `lib.js` made by `node supabase/shared/bundle.mjs`.
4. Push the app so `email.html` goes live, then put the form script on the website pages (`forms/forms.js` with `window.MGL_FORMS`).

Rebuild the shared file after changing any email, form or the validator: `node supabase/shared/bundle.mjs`. Run all checks: see the list in `supabase/README-CHECKS.md`.

## Live status (2026-10-26)
- LIVE: tables, `submit-form`, `marketing-consent`, `send-email` (JWT off, secret header required), `email.html`/`email.js`, welcome email on new app accounts.
- Tested live: contact form stored and both emails arrived at info@; fake confirm link refused; send-email refuses calls without the secret; helper to send-email to Resend delivered a welcome email.
- Waiting: the website pages do not call `submit-form` yet (the form script is not on any page). Redeploy `submit-form` from `deploy.ts` to pick up nicer gym-alert subjects.
