# MASTER PROMPT: build the MY GYM London app and website from zero

Copy everything below the line into a new Claude Code session. Fill in the [BRACKETS] first. Start the session with the app-builder-skill available.

---

You are building a complete digital setup for a small gym, from nothing, for its owner. Use the `app-builder-skill` for how to work with me, how to verify, and how to share. If it conflicts with anything below, the skill's working rules win.

## 0. Who I am and the business

- I own [GYM NAME], [ADDRESS], [CITY]. I am not a developer. Keep reports short and plain.
- Brand: white, near-black #17171a, red #e03939. Fonts: Barlow Condensed for headings, a clean sans for body. Use my own photos, original colours, no filters.
- Opening hours: [HOURS]. Phone: [PHONE]. Email: [EMAIL].
- I want control. Ask me before anything that could affect a live app, live site, live database, domain, or anything public. Local work and private previews need no asking.
- Never invent facts, reviews, prices, counts or IDs. If you do not have a fact, put a clearly marked placeholder and list it for me.
- No em dashes anywhere in product text.

## 1. Deliverables, in this order

1. **Member app (PWA)** at [APP DOMAIN]: installable on a phone, fast, works well on small screens.
2. **Backend** on Supabase: auth, database, row level security, push reminders.
3. **Website redesign mockup**: a static, shareable preview of the new public website. Built in Wix only when I say start.
4. **Legal pages**: privacy policy, terms and conditions and cookie notice for the website and the app, drafted from how the product really works. See section 6.
5. **Notes and handover**: `PROJECT-NOTES.md` (local, gitignored) with a section per release, plus a list of owner to-dos that are not code.

Do not start a later deliverable until I approve the earlier one.

## 2. Member app requirements

Accounts and profile
- Sign up, log in, reset password, as real `<form>` elements so password managers and Enter/Go work.
- Profile page with the health and safety form and consents. Sections unlock only when the form is complete. Optional consents (for example weight and body fat tracking) use a switch.

Booking
- Class timetable: [LIST OF CLASSES with days, times, durations, capacity].
- Gym slots: bookable hourly slots [HOURS], with spots left, Book, Booked, and Cancel.
- Book or cancel from any screen (including Home) must update every screen that shows it, immediately.
- Waiting, full and cancelled states are clear to the member.

Memberships and services
- Plans, sorted by price, cheapest first: [PLANS AND PRICES]. Pay-as-you-go class goes straight to the class timetable.
- Kids Gym: minimum age 8, [DAYS AND TIMES], [PRICE].

Referrals
- Refer a friend: [REWARD RULE]. Only the member who refers gets the reward.

Reminders
- Push reminders before a booked session. Tell me honestly what needs a real phone test.

Speed
- Read the saved session locally instead of asking the server on every tap. Buttons and switches update at once (optimistic UI), then reconcile with the server.

## 3. Backend requirements (Supabase)

- Tables for profiles, health forms and consents, classes, class sessions, gym slots, bookings, memberships, referrals, push subscriptions.
- Row level security on every table. A member can only read and write their own rows. Staff roles are separate.
- All schema changes are written as numbered SQL scripts in the repo. Show me each script and wait for my go-ahead before running anything against the live project.
- No secrets in the repo. Keys go in environment settings. Tell me where to put them.

## 4. Release process

- Git repo, branch `main`. One clear commit per change, numbered releases (v1, v2, ...).
- Before each release: run the verification checklist in the skill. Report only what was actually checked and say plainly what was not (real phone, live push, live login).
- Ask me before deploying to the live domain. After deploy, tell me exactly how to confirm it on my phone.
- Hosting: the app is served by Netlify (free) from the `main` branch of the repo, so every push to `main` goes live; list what will go live and get my yes before each push. Security headers live in `netlify.toml`. GitHub Pages is only the fallback.
- Classes and gym hours that have started (London time) cannot be seen or booked: this rule is enforced in the app, the booking function and the database trigger, and all three must stay in step.
- Never run `supabase/schema.sql` on the live project (it re-creates an open bookings policy and adds sample classes). When staging SQL for me, open a new query and check the tab text first.

## 5. Website mockup requirements

- Static single-page HTML with hash-routed views: home, classes, book, services, personal training, refer a friend, FAQ, log in.
- Built by Python generator scripts (base data, white theme, final overrides), never by hand editing the output. A script then produces a fully offline copy: fonts and images inlined, map replaced by a static picture.
- Pages and content:
  - Home: hero photo, "Classes that suit you", expert personal training, "Space to train" photo mosaic, "What members say" (sample quotes clearly labelled until real Google reviews are supplied), map and contact card with phone link and directions link.
  - Classes: filterable timetable, "Book now" opens the timetable filtered to that class group.
  - Book: date strip and hourly slots, working Book and Cancel buttons with a confirmation message.
  - Services: plans sorted by price, each with a clear call to action.
  - Personal training: coach profile, three options, a short wizard that ends by asking for an email and accepting terms.
  - Refer a friend, FAQ (about 10 questions), log in.
- Banner photos at full resolution, no resizing below 2000 px, no grading. Check crops on desktop and phone.
- Footer on every page: hours, phone as a `tel:` link, address, and links to Terms and conditions, Privacy policy and Cookie notice.
- Any "I agree to the terms" checkbox links to the Terms and the Privacy policy.
- Share it as a private claude.ai Artifact first. Never open a tunnel to my computer. Handle my comments one at a time: fix the generator, rebuild, republish to the same URL, reply in the thread, resolve.

## 6. Legal pages (privacy policy, terms and conditions, cookie notice)

Build these with the website, not at the end. They are drafts for a solicitor to check, not legal advice.

- Business details: [LEGAL BUSINESS NAME AND TYPE (sole trader, partnership or limited company)], [REGISTERED ADDRESS], [PREMISES ARRANGEMENT, for example a lease or an agreement with a school]. Never guess these.
- Write them from how the product really works, then check every claim against the code. If I tell you something and the code shows otherwise (for example what is logged, what the app enforces, or how long data is kept), write what is true and tell me.
- Privacy policy must cover: who we are, what we collect (account, membership, bookings, reminders, training logs, optional weight and body fat, health and safety form, sign-up logs, enquiries, referrals, payments), why and the legal basis, health information as special category data with explicit consent and how to withdraw, who we share it with, how long we keep it, where it is stored, children, rights and how to complain to the ICO.
- Terms must cover: accounts, memberships and payments (notice to cancel, refunds, failed payments, pay as you go), booking and cancelling classes and gym slots, health and safety, personal training cancellations, children's sessions and parent responsibility, referral rules, use of the website and app, liability limits that respect the law, belongings, changes, and governing law.
- Cookie notice must cover: what the app stores on the device, what the website builder and any embedded map set, and how to decline.
- Put one source in a file (for example `legal_pages.py`) that generates both the web pages and a Markdown file for me and a solicitor. Show every unknown as a highlighted `[CONFIRM: ...]` note and a "Draft for review" banner on each page.
- Ask me for each business rule one at a time as I answer comments, write final wording, and keep a note highlighted only where I have not answered. If something I decide cannot be done by the live app today, tell me and ask before changing the live app.
- Never invent suppliers, retention periods, prices or rules. Put a note and list it for me.
- Check the pages at desktop, 390 px and 320 px for overflow, and check every footer and checkbox link.

## 7. How to verify (mandatory before saying anything is checked)

1. List every link and button with its label and target. Confirm each goes somewhere that makes sense for a visitor.
2. Click every button on every view and confirm something visible happens.
3. Test at desktop, 390 px and 320 px. No horizontal overflow, nothing clipped or overlapping.
4. Scan in forced dark mode for unreadable text.
5. Check the browser console for hidden errors.
6. Check forms: validation order, escaped output, confirmation text.
7. End every report with what you could NOT test.

## 8. Start now

1. Read the skill. Then ask me, in one short message, only for the facts you cannot find or sensibly default: everything in [BRACKETS].
2. Propose a short plan: stack choices, folder layout, release 1 scope. Wait for my approval.
3. Build release 1 (accounts, profile, class timetable, booking) and show me a private preview.
4. Continue release by release, with a short report after each.

## 9. Owner to-dos (remind me, do not do for me)

- A solicitor checks the privacy policy, terms, cookie notice and health form consent text before they go live.
- Register with the ICO and pay the data protection fee (health information is held).
- Switch on the cookie banner on the live website and make declining as easy as accepting.
- The Create account form needs a tick box that links to the Terms and the Privacy Policy and blocks sign-up until ticked. Decide whether to also store who agreed, when and which version in the database (today the tick is checked in the browser only). Do not write "free account" on login pages.
- Decide whether the live app should enforce the cancellation limit and automatic deletion periods written in the legal pages.
- Real end-to-end push reminder test on my phone.
- Update the Google Business listing hours.
- Replace sample review quotes with real Google reviews.
- Provide real photos, class list, plans, prices and coach bio.

## How to work with the owner: prepare, highlight, hand over
Whenever a step needs the owner (keys, passwords, security settings, blocked clicks), do everything else first: open the right pages, folders and links, fill the safe fields, put text to paste on the clipboard, and mark the exact spots to click or paste into with red highlights. Then give a short numbered list and wait for "done". Never see or type secrets. Verify afterwards. Ask before production changes. This was confirmed by the owner on 2026-10-16 as the standard way of working.

**Every time, without being reminded (owner, 2026-10-20):** open each page the owner must touch in Chrome, already filled in and hash-checked; put NUMBERED RED BOXES on each spot in step order; take a screenshot and send it with SendUserFile; give a very short numbered list naming the Chrome tab. Never ask where things are and never assume the owner knows. If the browser tab group is lost, make a new one and rebuild the staging.


## Never publish without explicit approval
Before any git push, list every unpushed commit and changed file and push only what the owner approved; an unanswered question is not approval. Keep unapproved work out of commits that might be pushed. Applies equally to deploys, SQL, Wix settings and DNS. Owner rule, 2026-10-16.

## 10. Emails, forms, consent, coded website, SEO (added 2026-10-27)
- Email: use Resend (domain verified with SPF, DKIM, DMARC) from Supabase edge functions. One `send-email` function protected by a secret header; database hooks queue every email (welcome, booking confirmation and cancellation, 2-hour reminder, lead follow-up, engagement). Dedupe each send. Marketing only to confirmed double opt-in consent; keep the wording and date. Keep a status table of every email.
- Forms: one `submit-form` function validates, rate limits, stores (with a retention date and weekly purge) and emails both sides. An admin page lists enquiries and lets me mark them joined, not now or spam so follow-ups stop.
- Website: build it as code from one generator script (not Wix), host it on [HOSTING], keep payments/checkout on a separate subdomain [JOIN DOMAIN]. Security headers and old-address redirects in `.htaccess`.
- SEO and AI search: per-page titles and descriptions, JSON-LD, FAQ schema, `robots.txt` allowing AI crawlers, `llms.txt`, sitemap, Google Business Profile. No invented ratings or sample reviews on a live page.
- Hosting limits: on the Netlify free plan batch pushes (one per session); I click Deploy myself.
