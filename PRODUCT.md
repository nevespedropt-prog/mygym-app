# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Members** — local adults (commonly 30s–60s, mixed fitness levels and experience) using the installed PWA on their phone to book classes and gym slots, fill in their health form, track workouts, and manage their membership. Kids (minimum age 8) attend specific sessions. Over-50s are a named, intended audience.

**Owner and coaches** — the gym owner and coaches managing class bookings, reviewing enquiries, sending push notifications, and administering member data via the admin screens.

Both audiences are first-class users of the digital product.

## Product Purpose

A self-contained digital operation for MY GYM London: member self-service (booking, profile, health consent, membership, referrals, push reminders) and owner/coach management tools, all served from a single codebase as a PWA at app.mygymlondon.co.uk.

Success for a member: booking a class or gym slot in under a minute, knowing it is confirmed, and getting a push reminder before it starts.

Success for the owner: a system they control, that does not require a developer for routine changes, and that never surprises them with live changes they did not approve.

## Positioning

A private studio gym — not a commercial chain — where coaches know members by name, by goal, and by injury history. The digital product must reflect that personal relationship: no impersonal flows, no dark patterns, no assumed fitness baseline.

No joining fee. No contract required for most plans. This is a material differentiator and must be surfaced clearly wherever plans are shown.

## Operating Context

- Members primarily access the app on a phone; the PWA is designed to be installed to the home screen.
- The app must work offline for read operations (saved session, cached timetable); booking requires a live connection.
- Classes and gym slots that have already started (London time) are hidden from booking across the app, the booking function, and the database — all three must stay in sync.
- Every push to `main` goes live automatically. The owner's approval is required before any push to `main`. [Deployment platform to confirm — was Netlify; may have changed.]
- Admin screens (campaign, enquiries, notify) are for owner/coach use, not members.
- Supabase provides auth, database, row-level security, and push subscriptions. No secrets go in the repo.

## Capabilities and Constraints

**Member features (shipped or in scope):**
- Sign up / log in / password reset via real `<form>` elements (password-manager and Enter/Go compatible)
- Profile page gated behind a completed health and safety form with explicit consent
- Class timetable with book, cancel, waitlist, and full states
- Gym slots: bookable hourly slots showing spots left
- Optimistic UI: buttons update immediately, then reconcile with server
- Memberships: plans sorted cheapest first; pay-as-you-go goes straight to the timetable
- Kids Gym: minimum age 8, separate sessions
- Refer-a-friend: reward goes to the referring member only
- Push reminders before booked sessions (requires real-phone test before claiming it works)

**Admin features:**
- Campaign management, member enquiries, and push notification admin
- Standalone forms: contact, corporate enquiry, kids registration, PT enquiry, trial class, newsletter, landing offer

**Technical constraints:**
- Vanilla HTML/CSS/JS — no build step, no npm, no framework
- Fonts self-hosted (Barlow Condensed 700 and 800, system sans for body); no external font CDN
- Strict CSP in `_headers` (no inline scripts, no external scripts except Supabase)
- Jekyll/GitHub Pages config present in repo; `supabase/` and `netlify.toml` excluded from the published site. `netlify.toml` also present — deployment platform to confirm.
- SQL schema changes must be written as numbered scripts, reviewed by the owner, and never run `schema.sql` against the live project

## Brand Commitments

- **Name:** MY GYM London (product), MY GYM (short form in the app title)
- **Domain:** app.mygymlondon.co.uk (app), www.mygymlondon.co.uk (public website)
- **Email:** info@mygymlondon.co.uk
- **Social:** @mygym_london (Instagram)
- **Address:** Main Avenue, Bush Hill Park, Enfield EN1 1DS
- **Logo:** `icons/logo-header.png` (in repo) — must be used as-is
- **Voice:** direct, personal, non-intimidating; no em dashes anywhere in product text
- **Colours:** locked — white, #17171a (near-black), #e03939 (red accent)
- **Typeface:** Barlow Condensed 700/800 for display headings (self-hosted); system sans for body

## Evidence on Hand

Real member review quotes (three) are inline in `index.html` and labelled as real.

Real pricing is in `index.html`:
- Gym + Classes Membership: from £35/month
- Fitness Classes: from £6 per class
- 1-2-1 Personal Training: from £32.50 (30-minute sessions)
- Small Group PT (2–4 people): from £15
- Kids, Over 50s, Studio classes: from £8

Logo and favicon set are in `icons/`. No real gym photos are in the repository yet; future design work must not fabricate or use stock photography as stand-in without owner approval.

## Product Principles

1. **Personal, not anonymous.** Every interaction should feel like it comes from coaches who know the member — clear names, honest language, no dark patterns.
2. **Clear enough for everyone.** The interface must work for someone in their 50s or 60s who is new to gym apps: generous tap targets, legible type, no assumed prior fitness knowledge.
3. **Fast on a phone, honest about state.** Optimistic UI for booking, local session caching, offline-safe reads. When something fails, say so plainly.
4. **Owner in control.** No production change without the owner's explicit approval. The codebase is the owner's asset, not a developer's.
5. **True content only.** No invented prices, reviews, counts, photos, or claims. Mark every placeholder explicitly and list it for the owner to fill in.

## Accessibility & Inclusion

WCAG 2.1 AA required. Over-50s and fitness beginners are a core, named audience: type size, contrast, and tap-target decisions must favour this group.
