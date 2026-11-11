# Graph Report - mygym-app  (2026-11-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 900 nodes · 1550 edges · 89 communities (53 shown, 36 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 127 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b928e3a9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js (0)
- fn/submit-form/logic.ts (1)
- db.js (2)
- fn/send-email/lib.js (3)
- email-templates/render.mjs (4)
- migration-admin-backend-4.sql (5)
- fn/submit-form/deploy.ts (6)
- schema.sql
- fn/admin-campaign/logic.ts (8)
- fn/book-class/logic.ts (9)
- migration-forms-and-consent.sql (10)
- fn/admin-class-cancelled/logic.ts (11)
- fn/send-email/deploy.ts (12)
- DESIGN.md design system (13)
- fn/sync-wix-bookings/logic.ts (14)
- fn/admin-campaign/deploy.ts (15)
- shared/bundle.mjs (16)
- fn/admin-class-cancelled/deploy.ts (17)
- NEXT-SESSION.md (18)
- fn/send-booking-email/email.ts (19)
- fn/sync-timetable (20)
- migration-admin-backend.sql (21)
- migration-admin-backend-3.sql (22)
- manifest.json (23)
- forms/README.md (24)
- gen-client-exercises.js (25)
- migration-security-hardening.sql (26)
- forms/test.mjs (27)
- fn/sync-wix-payments (28)
- fn/marketing-consent/deploy.ts (29)
- forms/build.mjs (30)
- fn/book-class/cancel-email.test.mjs (31)
- admin-notify.js (32)
- MASTER-PROMPT.md (33)
- migration-booking-emails.sql (34)
- forms/forms.mjs (35)
- forms/forms.js (36)
- shared/validate.test.mjs (37)
- fn/marketing-consent (38)
- shared/tokens.mjs (39)
- shared/validate.mjs (40)
- MASTER-PROMPT.md (41)
- fn/check-gym-access (42)
- fn/member-signup (43)
- migration-meals.sql (44)
- admin-campaign.js (45)
- fn/weekly-report (46)
- migration-exercise-suggestions.sql (47)
- email-templates/README.md (49)
- send-class-reminders/index.ts
- migration-cancel-limit.sql (51)
- migration-email-redesign.sql (52)
- public.member_health
- public.set_my_marketing_consent
- WEEKLY-EXERCISE-REVIEW.md (55)
- sw.js (56)
- _config.yml (57)
- migration-class-access-plans.sql (58)
- public.form_submissions
- timetable.js (60)
- marketing-consent/deploy.ts
- public.app_flags
- public.booking_email_vars

## God Nodes (most connected - your core abstractions)
1. `public.class_bookings` - 48 edges
2. `public.classes` - 35 edges
3. `public.profiles` - 34 edges
4. `el()` - 21 edges
5. `public.wix_other_bookings` - 21 edges
6. `handle()` - 19 edges
7. `processSubmission()` - 17 edges
8. `public.marketing_consent` - 17 edges
9. `NEXT-SESSION.md handoff notes` - 17 edges
10. `renderWorkouts()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `getClasses()` --reads_from--> `public.classes`  [INFERRED]
  db.js → supabase/schema.sql
- `getPastBookings()` --reads_from--> `public.class_bookings`  [INFERRED]
  db.js → supabase/schema.sql
- `getProfile()` --reads_from--> `public.profiles`  [INFERRED]
  db.js → supabase/schema.sql
- `saveProfile()` --writes_to--> `public.profiles`  [INFERRED]
  db.js → supabase/schema.sql
- `addExercise()` --writes_to--> `public.exercise_suggestions`  [INFERRED]
  db.js → supabase/migration-exercise-suggestions.sql

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Form submission to email flow (forms, submit-form, send-email, templates)** — supabase_forms_readme_form_catalog, supabase_email_templates_wiring_action_matrix, supabase_email_templates_readme_library [EXTRACTED 0.95]
- **Brand identity shared across design, product and master prompt** — design_palette, design_typography, product_brand_commitments [INFERRED 0.85]
- **Wix replacement: hostinger site, emails, forms, payments** — next_session_wix_to_hostinger, supabase_email_templates_readme_wix_replacement, next_session_payment_emails [INFERRED 0.85]

## Communities (89 total, 36 thin omitted)

### Community 0 - "app.js (0)"
Cohesion: 0.07
Nodes (68): addExercise(), addToWorkout(), afterAuth(), barChart(), builderHasWork(), checkGym(), collectExercises(), currentSub() (+60 more)

### Community 1 - "fn/submit-form/logic.ts (1)"
Cohesion: 0.06
Nodes (37): ALLOWED_ORIGINS, cors(), json(), checkToken, forms, GLOBALS, m_forms, m_render (+29 more)

### Community 2 - "db.js (2)"
Cohesion: 0.11
Nodes (12): addWorkout(), book(), callBookClass(), cancel(), deleteWorkout(), getClasses(), getPastBookings(), getProfile() (+4 more)

### Community 3 - "fn/send-email/lib.js (3)"
Cohesion: 0.08
Nodes (22): checkToken, forms, GLOBALS, m_forms, m_render, m_settings, m_templates, m_tokens (+14 more)

### Community 4 - "email-templates/render.mjs (4)"
Cohesion: 0.11
Nodes (27): appDir, groups, here, items, prev, bodyBlocks(), button(), C (+19 more)

### Community 5 - "migration-admin-backend-4.sql (5)"
Cohesion: 0.14
Nodes (23): getBookingsForDates(), public.admin_analytics(), public.admin_timetable(), public.admin_waitlist(), public.waitlist, public.admin_class_remove(), public.admin_class_save(), public.admin_timetable_edit() (+15 more)

### Community 6 - "fn/submit-form/deploy.ts (6)"
Cohesion: 0.10
Nodes (21): addDays(), ALLOWED_ORIGINS, cors(), Ctx, Deps, firstWord(), Input, json() (+13 more)

### Community 7 - "schema.sql"
Cohesion: 0.20
Nodes (10): addTemplate(), addWeight(), deleteMeasurements(), getTemplates(), getWeights(), on_auth_user_created, public.handle_new_user(), public.is_admin() (+2 more)

### Community 8 - "fn/admin-campaign/logic.ts (8)"
Cohesion: 0.12
Nodes (17): ALLOWED_ORIGINS, cors(), json(), BATCH, campaign(), checkContent(), clean(), Deps (+9 more)

### Community 9 - "fn/book-class/logic.ts (9)"
Cohesion: 0.16
Nodes (24): cancelEmailVars(), cors, emailCancelled(), handle(), json(), wix(), wixCancel(), wixHeaders() (+16 more)

### Community 10 - "migration-forms-and-consent.sql (10)"
Cohesion: 0.18
Nodes (11): public.admin_health(), public.admin_emails(), public.admin_insights(), public.send_class_reminder_emails(), email_events_created_idx, email_hook_welcome, public.email_cron_health_reminders(), public.email_cron_week_one() (+3 more)

### Community 11 - "fn/admin-class-cancelled/logic.ts (11)"
Cohesion: 0.14
Nodes (11): ALLOWED_ORIGINS, cors(), json(), classCancelled(), Deps, Input, Out, pretty() (+3 more)

### Community 12 - "fn/send-email/deploy.ts (12)"
Cohesion: 0.13
Nodes (11): Deps, m_forms, m_render, m_settings, m_templates, m_tokens, m_validate, Out (+3 more)

### Community 13 - "DESIGN.md design system (13)"
Cohesion: 0.15
Nodes (14): Components (CTA, chips, cards, inputs, nav), DESIGN.md Design System, Design Do's and Don'ts, Elevation and Structural Float Rule, Mobile single-column layout with floating bottom nav, Creative North Star: The Neighbourhood Coach, Palette (Gym Red, neutrals), Shapes and Graduated Radius Rule (+6 more)

### Community 14 - "fn/sync-wix-bookings/logic.ts (14)"
Cohesion: 0.16
Nodes (13): wixHeaders(), wixPost(), ClassRow, DAYS, ExistingOther, ExistingRow, GYM, londonParts() (+5 more)

### Community 15 - "fn/admin-campaign/deploy.ts (15)"
Cohesion: 0.19
Nodes (10): ALLOWED_ORIGINS, campaign(), checkContent(), clean(), cors(), Deps, Input, json() (+2 more)

### Community 16 - "shared/bundle.mjs (16)"
Cohesion: 0.16
Nodes (8): here, MODULES, ONLY, root, TARGETS, wrap(), wrapped, root

### Community 17 - "fn/admin-class-cancelled/deploy.ts (17)"
Cohesion: 0.16
Nodes (9): ALLOWED_ORIGINS, classCancelled(), cors(), Deps, Input, json(), Out, pretty() (+1 more)

### Community 18 - "NEXT-SESSION.md (18)"
Cohesion: 0.16
Nodes (13): Release process and started-classes rule, Move deploy from Netlify to Cloudflare Pages (2026-10-30), DMARC reports review and pct ramp, NEXT-SESSION.md handoff notes, Enquiry status admin page, Instagram live feed (instagram-sync, instagram-feed), Opening hours 05:00 to midnight daily (Google/Wix wrong), Incident 2026-10-21: schema.sql re-run by mistake (+5 more)

### Community 19 - "fn/send-booking-email/email.ts (19)"
Cohesion: 0.21
Nodes (9): APP_URL, Booking, buildEmail(), CANCEL_MINUTES, ClassRow, esc(), firstName(), GYM_ADDRESS (+1 more)

### Community 20 - "fn/sync-timetable (20)"
Cohesion: 0.20
Nodes (11): addDays(), BLOCKED_GYM, DAYS, Kind, lengthText(), londonToday(), Row, syncKind() (+3 more)

### Community 21 - "migration-admin-backend.sql (21)"
Cohesion: 0.15
Nodes (16): public.admin_class_set_active(), public.admin_audit(), public.admin_dashboard(), public.admin_enquiries(), public.admin_marketing(), public.admin_members(), public.admin_staff_list(), public.admin_staff_set() (+8 more)

### Community 22 - "migration-admin-backend-3.sql (22)"
Cohesion: 0.16
Nodes (7): public.admin_attendance(), public.admin_checkin_roster(), public.admin_rota(), public.admin_tasks(), public.checkins, public.staff_shifts, public.staff_tasks

### Community 23 - "manifest.json (23)"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, name, orientation, scope (+4 more)

### Community 24 - "forms/README.md (24)"
Cohesion: 0.18
Nodes (8): Wix to Hostinger migration plan and launch checklist, Email library (56 emails, templates.mjs, render.mjs), Action to email status matrix, Owner steps to make built parts live, Built-in form safeguards (honeypot, rate limit, consent), Embedding forms on Wix / Hostinger via /f/ pages, Form catalog (11 forms), Automatic test commands and bundle step

### Community 25 - "gen-client-exercises.js (25)"
Cohesion: 0.15
Nodes (10): clash, db, dup, existing, fs, maxSort, names, out (+2 more)

### Community 26 - "migration-security-hardening.sql (26)"
Cohesion: 0.25
Nodes (6): public.enforce_booking_rules(), public.member_access, public.enforce_booking_rules(), booking_rules, public.enforce_booking_rules(), public.signup_attempts

### Community 27 - "forms/test.mjs (27)"
Cohesion: 0.18
Nodes (9): templates, here, out, pub, f(), forms, emailIds, kids (+1 more)

### Community 28 - "fn/sync-wix-payments (28)"
Cohesion: 0.20
Nodes (3): who(), wix(), wixHeaders()

### Community 29 - "fn/marketing-consent/deploy.ts (29)"
Cohesion: 0.28
Nodes (3): ALLOWED, public.instagram_posts, public.instagram_token

### Community 30 - "forms/build.mjs (30)"
Cohesion: 0.29
Nodes (9): appDir, here, nav, panes, prev, catalog(), esc(), field() (+1 more)

### Community 31 - "fn/book-class/cancel-email.test.mjs (31)"
Cohesion: 0.20
Nodes (6): body, calls, db, here, tmp, v

### Community 32 - "admin-notify.js (32)"
Cohesion: 0.39
Nodes (7): fillClasses(), iso(), nextDate(), reset(), setDate(), show(), start()

### Community 33 - "MASTER-PROMPT.md (33)"
Cohesion: 0.22
Nodes (6): Emails, forms, coded website, SEO (added 2026-10-27), Mandatory verification checklist, Emails and forms back end (submit-form, send-email, marketing-consent), Resend API key stored only in Supabase Secrets, Resend domain verification via Wix DNS, send-booking-email edge function and trigger

### Community 34 - "migration-booking-emails.sql (34)"
Cohesion: 0.33
Nodes (5): sendOne(), booking_email, public.email_log, public.notify_booking_email(), public.weekly_report_stats()

### Community 35 - "forms/forms.mjs (35)"
Cohesion: 0.25
Nodes (4): base, marketing, name(), utm

### Community 37 - "shared/validate.test.mjs (37)"
Cohesion: 0.25
Nodes (6): F, F, kid, pt, r, trial

### Community 38 - "fn/marketing-consent (38)"
Cohesion: 0.32
Nodes (6): ALLOWED_ORIGINS, cors(), json(), checkToken, m_tokens, makeToken

### Community 39 - "shared/tokens.mjs (39)"
Cohesion: 0.43
Nodes (7): b64u(), checkToken(), enc, fromB64u(), hex(), mac(), makeToken()

### Community 40 - "shared/validate.mjs (40)"
Cohesion: 0.46
Nodes (7): addDays(), ageOn(), asList(), clean(), META_MAX, validate(), validDate()

### Community 41 - "MASTER-PROMPT.md (41)"
Cohesion: 0.29
Nodes (7): Supabase backend requirements (RLS, numbered SQL), Deliverables: app, backend, website mockup, legal pages, notes, Legal pages (privacy, terms, cookies), Member app PWA requirements, Website mockup requirements (generator scripts), Member and admin capabilities, Technical constraints (vanilla JS, strict CSP, Supabase)

### Community 42 - "fn/check-gym-access (42)"
Cohesion: 0.36
Nodes (7): ALLOWED_ORIGINS, cors(), hasActiveGymOrder(), json(), wixHeaders(), wixMemberId(), public.gym_access_plans

### Community 43 - "fn/member-signup (43)"
Cohesion: 0.43
Nodes (6): ALLOWED_ORIGINS, cors(), getWixMember(), hasActivePlan(), json(), wixHeaders()

### Community 44 - "migration-meals.sql (44)"
Cohesion: 0.29
Nodes (8): getFoods(), getMealPlans(), getRecipes(), meal_plan_template_items_tpl, public.foods, public.meal_plan_template_items, public.meal_plan_templates, public.recipes

### Community 45 - "admin-campaign.js (45)"
Cohesion: 0.53
Nodes (4): call(), content(), show(), start()

### Community 46 - "fn/weekly-report (46)"
Cohesion: 0.22
Nodes (3): Stats, classes_wix_unique, public.sync_log

### Community 47 - "migration-exercise-suggestions.sql (47)"
Cohesion: 0.31
Nodes (8): addExercise(), getExercises(), public.exercises, exercise_suggestions_limit, exercise_suggestions_status_idx, exercise_suggestions_user_name_idx, public.exercise_suggestions, public.limit_exercise_suggestions()

### Community 49 - "email-templates/README.md (49)"
Cohesion: 0.50
Nodes (3): Payment and membership emails (sync-wix-payments, dormant), Launch decisions in settings.mjs, Wix email to replacement mapping

### Community 50 - "send-class-reminders/index.ts"
Cohesion: 0.29
Nodes (5): deletePushSub(), savePushSub(), public.booking_reminders, public.due_class_reminders(), public.push_subscriptions

### Community 53 - "public.member_health"
Cohesion: 0.29
Nodes (8): getHealth(), saveHealth(), turnOffMeasurements(), turnOnMeasurements(), withdrawHealth(), public.admin_member_health(), public.consent_log, public.member_health

### Community 54 - "public.set_my_marketing_consent"
Cohesion: 0.29
Nodes (4): getMarketing(), setMarketing(), public.my_marketing_consent(), public.set_my_marketing_consent()

### Community 59 - "public.form_submissions"
Cohesion: 0.43
Nodes (5): public.admin_forms_summary(), form_submissions_delete_idx, form_submissions_form_idx, form_submissions_status_idx, public.form_submissions

### Community 86 - "marketing-consent/deploy.ts"
Cohesion: 0.50
Nodes (4): ALLOWED_ORIGINS, cors(), json(), m_tokens

## Ambiguous Edges - Review These
- `Release process and started-classes rule` → `Move deploy from Netlify to Cloudflare Pages (2026-10-30)`  [AMBIGUOUS]
  NEXT-SESSION.md · relation: conceptually_related_to

## Knowledge Gaps
- **18 isolated node(s):** `Elevation and Structural Float Rule`, `Shapes and Graduated Radius Rule`, `Slot Row signature component`, `DMARC reports review and pct ramp`, `Enquiry status admin page` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 335 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.profiles` connect `migration-admin-backend.sql (21)` to `admin-notify.js (32)`, `fn/submit-form/logic.ts (1)`, `db.js (2)`, `migration-booking-emails.sql (34)`, `migration-admin-backend-4.sql (5)`, `fn/submit-form/deploy.ts (6)`, `schema.sql`, `fn/admin-campaign/logic.ts (8)`, `fn/book-class/logic.ts (9)`, `fn/check-gym-access (42)`, `fn/admin-class-cancelled/logic.ts (11)`, `migration-forms-and-consent.sql (10)`, `admin-campaign.js (45)`, `fn/admin-campaign/deploy.ts (15)`, `fn/admin-class-cancelled/deploy.ts (17)`, `migration-admin-backend-3.sql (22)`, `public.booking_email_vars`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `public.class_bookings` (e.g. with `book()` and `cancel()`) actually correct?**
  _`public.class_bookings` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Elevation and Structural Float Rule`, `Shapes and Graduated Radius Rule`, `Slot Row signature component` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js (0)` be split into smaller, more focused modules?**
  _Cohesion score 0.07441688263606072 - nodes in this community are weakly interconnected._
- **Why does `public.class_bookings` connect `migration-admin-backend-4.sql (5)` to `db.js (2)`, `migration-booking-emails.sql (34)`, `schema.sql`, `fn/book-class/logic.ts (9)`, `migration-forms-and-consent.sql (10)`, `fn/admin-class-cancelled/logic.ts (11)`, `fn/sync-wix-bookings/logic.ts (14)`, `fn/admin-class-cancelled/deploy.ts (17)`, `send-class-reminders/index.ts`, `fn/send-booking-email/email.ts (19)`, `migration-cancel-limit.sql (51)`, `migration-admin-backend.sql (21)`, `migration-admin-backend-3.sql (22)`, `public.booking_email_vars`, `migration-security-hardening.sql (26)`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `public.classes` (e.g. with `start()` and `getClasses()`) actually correct?**
  _`public.classes` has 5 INFERRED edges - model-reasoned connections that need verification._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Release process and started-classes rule` and `Move deploy from Netlify to Cloudflare Pages (2026-10-30)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._