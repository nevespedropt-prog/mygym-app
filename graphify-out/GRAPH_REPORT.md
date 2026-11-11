# Graph Report - mygym-app  (2026-11-11)

## Corpus Check
- 273 files · ~212,666 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 4, .woff2 2, .ico 1)

## Summary
- 706 nodes · 1101 edges · 37 communities (31 shown, 6 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 74 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- app.js (0)
- fn/submit-form/logic.ts (1)
- MASTER-PROMPT.md rules (2)
- fn/check-gym-access (3)
- db.js (4)
- email-templates/render.mjs (5)
- fn/send-email/lib.js (6)
- fn/submit-form/deploy.ts (7)
- fn/admin-campaign/logic.ts (8)
- fn/book-class/logic.ts (9)
- DESIGN.md design system (10)
- fn/admin-class-cancelled/logic.ts (11)
- fn/send-email/deploy.ts (12)
- forms/build.mjs (13)
- fn/sync-wix-bookings/logic.ts (14)
- fn/admin-campaign/deploy.ts (15)
- fn/admin-class-cancelled/deploy.ts (16)
- fn/send-booking-email/email.ts (17)
- fn/sync-timetable (18)
- manifest.json (19)
- gen-client-exercises.js (20)
- fn/sync-wix-payments (21)
- forms/build-pages.mjs (22)
- fn/book-class/cancel-email.test.mjs (23)
- admin-notify.js (24)
- shared/bundle.mjs (25)
- forms/forms.mjs (26)
- forms/forms.js (27)
- shared/validate.test.mjs (28)
- shared/tokens.mjs (29)
- shared/validate.mjs (30)
- admin-campaign.js (31)
- sw.js (33)
- _config.yml (34)
- timetable.js (35)

## God Nodes (most connected - your core abstractions)
1. `el()` - 21 edges
2. `processSubmission()` - 17 edges
3. `NEXT-SESSION.md handoff notes` - 17 edges
4. `renderWorkouts()` - 14 edges
5. `processSubmission()` - 14 edges
6. `go()` - 13 edges
7. `handle()` - 13 edges
8. `render()` - 12 edges
9. `sendEmail()` - 12 edges
10. `renderTimetable()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Email library (56 emails, templates.mjs, render.mjs)` --shares_data_with--> `Typography (Barlow Condensed + system sans)`  [INFERRED]
  supabase/email-templates/README.md → DESIGN.md
- `Prepare, highlight, hand over working rule` --semantically_similar_to--> `Product principles (personal, clear, fast, owner control, true content)`  [INFERRED] [semantically similar]
  MASTER-PROMPT.md → PRODUCT.md
- `Move deploy from Netlify to Cloudflare Pages (2026-10-30)` --conceptually_related_to--> `Release process and started-classes rule`  [AMBIGUOUS]
  NEXT-SESSION.md → MASTER-PROMPT.md
- `Embedding forms on Wix / Hostinger via /f/ pages` --conceptually_related_to--> `Wix to Hostinger migration plan and launch checklist`  [INFERRED]
  supabase/forms/README.md → NEXT-SESSION.md
- `Design Do's and Don'ts` --implements--> `Product principles (personal, clear, fast, owner control, true content)`  [INFERRED]
  DESIGN.md → PRODUCT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Form submission to email flow (forms, submit-form, send-email, templates)** — supabase_forms_readme_form_catalog, supabase_email_templates_wiring_action_matrix, supabase_email_templates_readme_library [EXTRACTED 0.95]
- **Brand identity shared across design, product and master prompt** — design_palette, design_typography, product_brand_commitments [INFERRED 0.85]
- **Wix replacement: hostinger site, emails, forms, payments** — next_session_wix_to_hostinger, supabase_email_templates_readme_wix_replacement, next_session_payment_emails [INFERRED 0.85]

## Communities (37 total, 6 thin omitted)

### Community 0 - "app.js (0)"
Cohesion: 0.07
Nodes (68): addExercise(), addToWorkout(), afterAuth(), barChart(), builderHasWork(), checkGym(), collectExercises(), currentSub() (+60 more)

### Community 1 - "fn/submit-form/logic.ts (1)"
Cohesion: 0.06
Nodes (37): ALLOWED_ORIGINS, cors(), json(), checkToken, forms, GLOBALS, m_forms, m_render (+29 more)

### Community 2 - "MASTER-PROMPT.md rules (2)"
Cohesion: 0.06
Nodes (32): Emails, forms, coded website, SEO (added 2026-10-27), Release process and started-classes rule, Mandatory verification checklist, Move deploy from Netlify to Cloudflare Pages (2026-10-30), DMARC reports review and pct ramp, NEXT-SESSION.md handoff notes, Emails and forms back end (submit-form, send-email, marketing-consent), Enquiry status admin page (+24 more)

### Community 3 - "fn/check-gym-access (3)"
Cohesion: 0.06
Nodes (24): ALLOWED_ORIGINS, cors(), hasActiveGymOrder(), json(), wixHeaders(), wixMemberId(), ALLOWED, ALLOWED_ORIGINS (+16 more)

### Community 4 - "db.js (4)"
Cohesion: 0.05
Nodes (3): book(), callBookClass(), cancel()

### Community 5 - "email-templates/render.mjs (5)"
Cohesion: 0.11
Nodes (28): appDir, groups, here, items, prev, bodyBlocks(), button(), C (+20 more)

### Community 6 - "fn/send-email/lib.js (6)"
Cohesion: 0.08
Nodes (22): checkToken, forms, GLOBALS, m_forms, m_render, m_settings, m_templates, m_tokens (+14 more)

### Community 7 - "fn/submit-form/deploy.ts (7)"
Cohesion: 0.10
Nodes (21): addDays(), ALLOWED_ORIGINS, cors(), Ctx, Deps, firstWord(), Input, json() (+13 more)

### Community 8 - "fn/admin-campaign/logic.ts (8)"
Cohesion: 0.12
Nodes (17): ALLOWED_ORIGINS, cors(), json(), BATCH, campaign(), checkContent(), clean(), Deps (+9 more)

### Community 9 - "fn/book-class/logic.ts (9)"
Cohesion: 0.16
Nodes (24): cancelEmailVars(), cors, emailCancelled(), handle(), json(), wix(), wixCancel(), wixHeaders() (+16 more)

### Community 10 - "DESIGN.md design system (10)"
Cohesion: 0.10
Nodes (21): Components (CTA, chips, cards, inputs, nav), DESIGN.md Design System, Design Do's and Don'ts, Elevation and Structural Float Rule, Mobile single-column layout with floating bottom nav, Creative North Star: The Neighbourhood Coach, Palette (Gym Red, neutrals), Shapes and Graduated Radius Rule (+13 more)

### Community 11 - "fn/admin-class-cancelled/logic.ts (11)"
Cohesion: 0.14
Nodes (11): ALLOWED_ORIGINS, cors(), json(), classCancelled(), Deps, Input, Out, pretty() (+3 more)

### Community 12 - "fn/send-email/deploy.ts (12)"
Cohesion: 0.14
Nodes (10): Deps, m_forms, m_render, m_settings, m_templates, m_tokens, m_validate, Out (+2 more)

### Community 13 - "forms/build.mjs (13)"
Cohesion: 0.18
Nodes (14): appDir, here, nav, panes, prev, f(), catalog(), esc() (+6 more)

### Community 14 - "fn/sync-wix-bookings/logic.ts (14)"
Cohesion: 0.16
Nodes (13): wixHeaders(), wixPost(), ClassRow, DAYS, ExistingOther, ExistingRow, GYM, londonParts() (+5 more)

### Community 15 - "fn/admin-campaign/deploy.ts (15)"
Cohesion: 0.19
Nodes (10): ALLOWED_ORIGINS, campaign(), checkContent(), clean(), cors(), Deps, Input, json() (+2 more)

### Community 16 - "fn/admin-class-cancelled/deploy.ts (16)"
Cohesion: 0.16
Nodes (9): ALLOWED_ORIGINS, classCancelled(), cors(), Deps, Input, json(), Out, pretty() (+1 more)

### Community 17 - "fn/send-booking-email/email.ts (17)"
Cohesion: 0.20
Nodes (10): APP_URL, Booking, buildEmail(), CANCEL_MINUTES, ClassRow, esc(), firstName(), GYM_ADDRESS (+2 more)

### Community 18 - "fn/sync-timetable (18)"
Cohesion: 0.20
Nodes (10): addDays(), BLOCKED_GYM, DAYS, Kind, lengthText(), londonToday(), Row, websitePattern() (+2 more)

### Community 19 - "manifest.json (19)"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, name, orientation, scope (+4 more)

### Community 20 - "gen-client-exercises.js (20)"
Cohesion: 0.15
Nodes (10): clash, db, dup, existing, fs, maxSort, names, out (+2 more)

### Community 21 - "fn/sync-wix-payments (21)"
Cohesion: 0.20
Nodes (3): who(), wix(), wixHeaders()

### Community 22 - "forms/build-pages.mjs (22)"
Cohesion: 0.24
Nodes (4): here, out, pub, root

### Community 23 - "fn/book-class/cancel-email.test.mjs (23)"
Cohesion: 0.20
Nodes (6): body, calls, db, here, tmp, v

### Community 24 - "admin-notify.js (24)"
Cohesion: 0.39
Nodes (7): fillClasses(), iso(), nextDate(), reset(), setDate(), show(), start()

### Community 25 - "shared/bundle.mjs (25)"
Cohesion: 0.25
Nodes (7): here, MODULES, ONLY, root, TARGETS, wrap(), wrapped

### Community 26 - "forms/forms.mjs (26)"
Cohesion: 0.25
Nodes (4): base, marketing, name(), utm

### Community 28 - "shared/validate.test.mjs (28)"
Cohesion: 0.25
Nodes (6): F, F, kid, pt, r, trial

### Community 29 - "shared/tokens.mjs (29)"
Cohesion: 0.43
Nodes (7): b64u(), checkToken(), enc, fromB64u(), hex(), mac(), makeToken()

### Community 30 - "shared/validate.mjs (30)"
Cohesion: 0.46
Nodes (7): addDays(), ageOn(), asList(), clean(), META_MAX, validate(), validDate()

### Community 31 - "admin-campaign.js (31)"
Cohesion: 0.53
Nodes (4): call(), content(), show(), start()

## Ambiguous Edges - Review These
- `Release process and started-classes rule` → `Move deploy from Netlify to Cloudflare Pages (2026-10-30)`  [AMBIGUOUS]
  NEXT-SESSION.md · relation: conceptually_related_to

## Knowledge Gaps
- **18 isolated node(s):** `Elevation and Structural Float Rule`, `Shapes and Graduated Radius Rule`, `Slot Row signature component`, `DMARC reports review and pct ramp`, `Enquiry status admin page` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 304 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 8 inferred relationships involving `processSubmission()` (e.g. with `.countByIp()` and `.countByUser()`) actually correct?**
  _`processSubmission()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Elevation and Structural Float Rule`, `Shapes and Graduated Radius Rule`, `Slot Row signature component` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js (0)` be split into smaller, more focused modules?**
  _Cohesion score 0.07441688263606072 - nodes in this community are weakly interconnected._
- **Should `fn/submit-form/logic.ts (1)` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `MASTER-PROMPT.md rules (2)` be split into smaller, more focused modules?**
  _Cohesion score 0.059800664451827246 - nodes in this community are weakly interconnected._
- **Should `fn/check-gym-access (3)` be split into smaller, more focused modules?**
  _Cohesion score 0.05647840531561462 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Release process and started-classes rule` and `Move deploy from Netlify to Cloudflare Pages (2026-10-30)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._