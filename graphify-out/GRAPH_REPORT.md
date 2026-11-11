# Graph Report - mygym-app  (2026-11-11)

## Corpus Check
- 274 files · ~218,515 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 3, .woff2 2, .ico 1)

## Summary
- 1226 nodes · 2488 edges · 76 communities (58 shown, 18 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 117 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Vendored supabase-js auth
- Vendored supabase-js client
- App UI (app.js)
- Edge function shared lib
- Vendored realtime client
- Local data layer (db.js)
- Vendored storage client
- Forms edge function
- Deploy edge function A
- Vendored supabase-js internals
- Edge function with batching
- Cancellation emails
- Community 12
- Page build scripts
- Nav/page build
- London-date scheduled function
- Community 16
- Community 17
- DESIGN.md design system
- Wix sync function
- Email template renderer
- Community 21
- Community 22
- Community 23
- Form validation
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 75

## God Nodes (most connected - your core abstractions)
1. `P()` - 83 edges
2. `J()` - 66 edges
3. `_returnResult()` - 53 edges
4. `t()` - 47 edges
5. `constructor()` - 34 edges
6. `_useSession()` - 33 edges
7. `n()` - 25 edges
8. `_debug()` - 25 edges
9. `el()` - 21 edges
10. `D()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Email library (56 emails, templates.mjs, render.mjs)` --shares_data_with--> `Typography (Barlow Condensed + system sans)`  [INFERRED]
  supabase/email-templates/README.md → DESIGN.md
- `Prepare, highlight, hand over working rule` --semantically_similar_to--> `Product principles (personal, clear, fast, owner control, true content)`  [INFERRED] [semantically similar]
  MASTER-PROMPT.md → PRODUCT.md
- `Move deploy from Netlify to Cloudflare Pages (2026-10-30)` --conceptually_related_to--> `Release process and started-classes rule`  [AMBIGUOUS]
  NEXT-SESSION.md → MASTER-PROMPT.md
- `Embedding forms on Wix / Hostinger via /f/ pages` --conceptually_related_to--> `Wix to Hostinger migration plan and launch checklist`  [INFERRED]
  supabase/forms/README.md → NEXT-SESSION.md
- `Emails and forms back end (submit-form, send-email, marketing-consent)` --references--> `Action to email status matrix`  [EXTRACTED]
  NEXT-SESSION.md → supabase/email-templates/WIRING.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Form submission to email flow (forms, submit-form, send-email, templates)** — supabase_forms_readme_form_catalog, supabase_email_templates_wiring_action_matrix, supabase_email_templates_readme_library [EXTRACTED 0.95]
- **Wix replacement: hostinger site, emails, forms, payments** — next_session_wix_to_hostinger, supabase_email_templates_readme_wix_replacement, next_session_payment_emails [INFERRED 0.85]
- **Brand identity shared across design, product and master prompt** — design_palette, design_typography, product_brand_commitments [INFERRED 0.85]

## Communities (76 total, 18 thin omitted)

### Community 0 - "Vendored supabase-js auth"
Cohesion: 0.06
Nodes (124): _acquireLock(), _adminDeletePasskey(), _adminListPasskeys(), _approveAuthorization(), _authenticate(), _autoRefreshTokenTick(), _callRefreshToken(), _challenge() (+116 more)

### Community 1 - "Vendored supabase-js client"
Cohesion: 0.02
Nodes (7): ar(), dr(), fi(), Ir(), _isImplicitGrantCallback(), Tr(), wi()

### Community 2 - "App UI (app.js)"
Cohesion: 0.07
Nodes (68): addExercise(), addToWorkout(), afterAuth(), barChart(), builderHasWork(), checkGym(), collectExercises(), currentSub() (+60 more)

### Community 3 - "Edge function shared lib"
Cohesion: 0.06
Nodes (37): ALLOWED_ORIGINS, cors(), json(), checkToken, forms, GLOBALS, m_forms, m_render (+29 more)

### Community 4 - "Vendored realtime client"
Cohesion: 0.08
Nodes (50): _cancelPendingDisconnect(), channel(), clearHeartbeats(), connect(), connectionState(), connectWithFallback(), disconnect(), flushSendBuffer() (+42 more)

### Community 5 - "Local data layer (db.js)"
Cohesion: 0.05
Nodes (3): book(), callBookClass(), cancel()

### Community 6 - "Vendored storage client"
Cohesion: 0.07
Nodes (38): br(), Cr(), createBucket(), createIndex(), createSignedUploadUrl(), createSignedUrl(), createSignedUrls(), D() (+30 more)

### Community 7 - "Forms edge function"
Cohesion: 0.08
Nodes (22): checkToken, forms, GLOBALS, m_forms, m_render, m_settings, m_templates, m_tokens (+14 more)

### Community 8 - "Deploy edge function A"
Cohesion: 0.10
Nodes (21): addDays(), ALLOWED_ORIGINS, cors(), Ctx, Deps, firstWord(), Input, json() (+13 more)

### Community 9 - "Vendored supabase-js internals"
Cohesion: 0.08
Nodes (27): constructor(), et(), _getPayloadRecords(), _handleTokenChanged(), Hn(), _initRealtimeClient(), _initSupabaseAuthClient(), inPendingSyncState() (+19 more)

### Community 10 - "Edge function with batching"
Cohesion: 0.12
Nodes (17): ALLOWED_ORIGINS, cors(), json(), BATCH, campaign(), checkContent(), clean(), Deps (+9 more)

### Community 11 - "Cancellation emails"
Cohesion: 0.16
Nodes (24): cancelEmailVars(), cors, emailCancelled(), handle(), json(), wix(), wixCancel(), wixHeaders() (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (14): body, calls, db, here, tmp, v, here, MODULES (+6 more)

### Community 13 - "Page build scripts"
Cohesion: 0.15
Nodes (18): appDir, here, nav, here, out, pub, panes, prev (+10 more)

### Community 14 - "Nav/page build"
Cohesion: 0.12
Nodes (13): appDir, groups, here, items, prev, GLOBALS, templates, SAMPLE (+5 more)

### Community 15 - "London-date scheduled function"
Cohesion: 0.14
Nodes (11): ALLOWED_ORIGINS, cors(), json(), classCancelled(), Deps, Input, Out, pretty() (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (21): ai(), clone(), gr(), invoke(), n(), c(), i(), o() (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (19): add(), eq(), gt(), gte(), ht(), ilike(), imatch(), in() (+11 more)

### Community 18 - "DESIGN.md design system"
Cohesion: 0.15
Nodes (14): Components (CTA, chips, cards, inputs, nav), DESIGN.md Design System, Design Do's and Don'ts, Elevation and Structural Float Rule, Mobile single-column layout with floating bottom nav, Creative North Star: The Neighbourhood Coach, Palette (Gym Red, neutrals), Shapes and Graduated Radius Rule (+6 more)

### Community 19 - "Wix sync function"
Cohesion: 0.16
Nodes (13): wixHeaders(), wixPost(), ClassRow, DAYS, ExistingOther, ExistingRow, GYM, londonParts() (+5 more)

### Community 20 - "Email template renderer"
Cohesion: 0.28
Nodes (15): bodyBlocks(), button(), C, catalog(), esc(), fill(), footer(), hero() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (10): ALLOWED_ORIGINS, campaign(), checkContent(), clean(), cors(), Deps, Input, json() (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (16): ajax(), batchSend(), close(), closeAndRetry(), endpointURL(), _fetchWithTimeout(), hasReceived(), httpSend() (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (9): ALLOWED_ORIGINS, classCancelled(), cors(), Deps, Input, json(), Out, pretty() (+1 more)

### Community 24 - "Form validation"
Cohesion: 0.20
Nodes (12): addDays(), ageOn(), asList(), clean(), META_MAX, F, kid, pt (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (15): assertFieldSize(), _binaryDecode(), binaryEncode(), _binaryEncodeUserBroadcastPush(), decode(), decodeBroadcast(), decodePush(), decodeReply() (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (13): Release process and started-classes rule, Move deploy from Netlify to Cloudflare Pages (2026-10-30), DMARC reports review and pct ramp, NEXT-SESSION.md handoff notes, Enquiry status admin page, Instagram live feed (instagram-sync, instagram-feed), Opening hours 05:00 to midnight daily (Google/Wix wrong), Incident 2026-10-21: schema.sql re-run by mistake (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.20
Nodes (10): APP_URL, Booking, buildEmail(), CANCEL_MINUTES, ClassRow, esc(), firstName(), GYM_ADDRESS (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.20
Nodes (10): addDays(), BLOCKED_GYM, DAYS, Kind, lengthText(), londonToday(), Row, websitePattern() (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, name, orientation, scope (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (8): Wix to Hostinger migration plan and launch checklist, Email library (56 emails, templates.mjs, render.mjs), Action to email status matrix, Owner steps to make built parts live, Built-in form safeguards (honeypot, rate limit, consent), Embedding forms on Wix / Hostinger via /f/ pages, Form catalog (11 forms), Automatic test commands and bundle step

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (10): clash, db, dup, existing, fs, maxSort, names, out (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (13): cancelRefEvent(), cancelTimeout(), canPush(), destroy(), filterBindings(), isJoined(), isMember(), joinRef() (+5 more)

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (13): catch(), de(), execute(), exists(), finally(), getOpenApiSpec(), getPromise(), handleOperation() (+5 more)

### Community 34 - "Community 34"
Cohesion: 0.20
Nodes (3): who(), wix(), wixHeaders()

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (8): m_forms, m_render, m_settings, m_templates, m_tokens, m_validate, Out, Req

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (11): cloneRequestState(), delete(), insert(), It(), select(), setHeader(), update(), upload() (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.39
Nodes (7): fillClasses(), iso(), nextDate(), reset(), setDate(), show(), start()

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (6): Emails, forms, coded website, SEO (added 2026-10-27), Mandatory verification checklist, Emails and forms back end (submit-form, send-email, marketing-consent), Resend API key stored only in Supabase Secrets, Resend domain verification via Wix DNS, send-booking-email edge function and trigger

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (4): base, marketing, name(), utm

### Community 43 - "Community 43"
Cohesion: 0.32
Nodes (6): ALLOWED_ORIGINS, cors(), json(), checkToken, m_tokens, makeToken

### Community 44 - "Community 44"
Cohesion: 0.43
Nodes (7): b64u(), checkToken(), enc, fromB64u(), hex(), mac(), makeToken()

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (8): createTable(), createTableIfNotExists(), dropTable(), listTables(), loadTable(), tableExists(), updateTable(), wt()

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (8): ee(), g(), h(), _isPKCECallback(), Kr(), m(), Ur(), zr()

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (7): Supabase backend requirements (RLS, numbered SQL), Deliverables: app, backend, website mockup, legal pages, notes, Legal pages (privacy, terms, cookies), Member app PWA requirements, Website mockup requirements (generator scripts), Member and admin capabilities, Technical constraints (vanilla JS, strict CSP, Supabase)

### Community 48 - "Community 48"
Cohesion: 0.43
Nodes (6): ALLOWED_ORIGINS, cors(), hasActiveGymOrder(), json(), wixHeaders(), wixMemberId()

### Community 49 - "Community 49"
Cohesion: 0.43
Nodes (6): ALLOWED_ORIGINS, cors(), getWixMember(), hasActivePlan(), json(), wixHeaders()

### Community 50 - "Community 50"
Cohesion: 0.53
Nodes (4): call(), content(), show(), start()

### Community 52 - "Community 52"
Cohesion: 0.47
Nodes (6): Ke(), onJoinPayload(), onLeavePayload(), qe(), transformState(), Ye()

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (6): _notThisChannelEvent(), subscribe(), unsubscribe(), _updateFilterMessage(), updateJoinPayload(), _updatePostgresBindings()

### Community 54 - "Community 54"
Cohesion: 0.50
Nodes (4): ALLOWED_ORIGINS, cors(), json(), m_tokens

### Community 55 - "Community 55"
Cohesion: 0.40
Nodes (5): dropNamespace(), listNamespaces(), loadNamespaceMetadata(), namespaceExists(), St()

### Community 56 - "Community 56"
Cohesion: 0.60
Nodes (5): fetchRequest(), parseJSON(), request(), xdomainRequest(), xhrRequest()

### Community 58 - "Community 58"
Cohesion: 0.50
Nodes (3): Payment and membership emails (sync-wix-payments, dormant), Launch decisions in settings.mjs, Wix email to replacement mapping

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (4): applyTransformOptsToQuery(), download(), _getFinalPath(), getPublicUrl()

### Community 61 - "Community 61"
Cohesion: 0.67
Nodes (4): At(), Dt(), kt(), Ot()

### Community 62 - "Community 62"
Cohesion: 0.50
Nodes (4): Cn(), Ln(), Tn(), wn()

### Community 64 - "Community 64"
Cohesion: 0.67
Nodes (3): detectEnvironment(), getWebSocketConstructor(), isWebSocketSupported()

## Ambiguous Edges - Review These
- `Release process and started-classes rule` → `Move deploy from Netlify to Cloudflare Pages (2026-10-30)`  [AMBIGUOUS]
  NEXT-SESSION.md · relation: conceptually_related_to

## Knowledge Gaps
- **18 isolated node(s):** `Elevation and Structural Float Rule`, `Shapes and Graduated Radius Rule`, `Slot Row signature component`, `Website mockup requirements (generator scripts)`, `Legal pages (privacy, terms, cookies)` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 400 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 12 inferred relationships involving `t()` (e.g. with `br()` and `_challenge()`) actually correct?**
  _`t()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Elevation and Structural Float Rule`, `Shapes and Graduated Radius Rule`, `Slot Row signature component` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Vendored supabase-js auth` be split into smaller, more focused modules?**
  _Cohesion score 0.05559926567007606 - nodes in this community are weakly interconnected._
- **Should `Vendored supabase-js client` be split into smaller, more focused modules?**
  _Cohesion score 0.019230769230769232 - nodes in this community are weakly interconnected._
- **Should `App UI (app.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.07441688263606072 - nodes in this community are weakly interconnected._
- **Should `Edge function shared lib` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Release process and started-classes rule` and `Move deploy from Netlify to Cloudflare Pages (2026-10-30)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._