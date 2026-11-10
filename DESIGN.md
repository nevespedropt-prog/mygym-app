---
name: MY GYM London
description: Private community gym app — book, track, and belong.
colors:
  acc: "#e03939"
  accd: "#a03535"
  accs: "#fdecec"
  ok: "#2e9e5b"
  txt: "#1d1d20"
  mut: "#66656d"
  bg: "#f6f5f4"
  card: "#ffffff"
  card2: "#f6f6f7"
  line: "#ececee"
typography:
  display:
    fontFamily: "\"Barlow Condensed\", \"Arial Narrow\", Impact, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "0em"
  headline:
    fontFamily: "\"Barlow Condensed\", \"Arial Narrow\", Impact, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "0.03em"
  cta:
    fontFamily: "\"Barlow Condensed\", \"Arial Narrow\", Impact, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
rounded:
  pill: "999px"
  hero: "24px"
  nav: "22px"
  card: "20px"
  stat: "16px"
  cta: "14px"
  input: "12px"
spacing:
  xs: "10px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  cta-primary:
    backgroundColor: "{colors.acc}"
    textColor: "#ffffff"
    typography: "{typography.cta}"
    rounded: "{rounded.cta}"
    padding: "15px"
  cta-primary-hover:
    backgroundColor: "{colors.accd}"
    textColor: "#ffffff"
    rounded: "{rounded.cta}"
    padding: "15px"
  cta-alt:
    backgroundColor: "{colors.card}"
    textColor: "{colors.acc}"
    rounded: "{rounded.cta}"
    padding: "15px"
  button-header:
    backgroundColor: "{colors.acc}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "{colors.card}"
    textColor: "{colors.txt}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  button-small:
    backgroundColor: "{colors.acc}"
    textColor: "#ffffff"
    typography: "{typography.cta}"
    rounded: "{rounded.pill}"
    padding: "10px 17px"
  chip:
    backgroundColor: "{colors.accs}"
    textColor: "{colors.acc}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "16px"
  input:
    backgroundColor: "{colors.card2}"
    textColor: "{colors.txt}"
    rounded: "{rounded.input}"
    padding: "12px 14px"
---

# Design System: MY GYM London

## Overview

**Creative North Star: "The Neighbourhood Coach"**

This is a gym where the coach knows your name, your goals, and your dodgy knee. The design reflects that: direct, warm, and confident without being loud. Everything earns its place. The red is a signal, not a decoration. The type is bold and compressed because a wall-mounted class board doesn't have room for small gestures — and neither does a phone screen you're checking between sets.

The system is mobile-native and action-first. Density is generous: 16px body type, 14-20px tap targets, comfortable card padding. There's no visual layering of modals inside modals, no sidebar navigation to learn. One column, one action per screen, one colour that means "do something now." The result feels less like a fitness app and more like a noticeboard at the front desk of a gym that's been running for fifteen years.

Aesthetic rejections are few but firm: no gradients beyond the hero card, no secondary accent colours competing with the red, no Barlow Condensed used in lowercase.

**Key Characteristics:**
- Condensed uppercase Barlow for all headings and action labels — assertive at any size
- Generously rounded cards (20px) with pill-shaped interactive elements — friendly and thumb-friendly
- One signal colour (#e03939) used only for action and status, never decoration
- Mobile-first single-column layout with a floating bottom nav
- Flat surfaces with structural lifts at the hero and navigation level

## Colors

A tight two-role palette: one red signal and one neutral field. The red does all the work of action, attention, and brand recognition. The neutral range supplies structure without competing.

### Primary

- **Gym Red** (`#e03939`): The single action signal. CTAs, chips, active states, focus rings, the hero gradient, left-border accents on quotes and alerts. Used sparingly — its rarity gives it authority.
- **Deep Gym Red** (`#a03535`): Hover and pressed states for red elements; the dark end of the hero gradient. Never used as a standalone fill.
- **Red Tint** (`#fdecec`): Restrained backgrounds for chips, alert banners, icon containers, and anything that belongs in the red family without claiming full red weight.

### Neutral

- **Off-Black** (`#1d1d20`): Primary text colour. Near-black rather than pure black keeps the tone warm.
- **Stone Muted** (`#66656d`): Secondary and metadata text — timestamps, helper labels, inactive nav items.
- **Warm Plaster** (`#f6f5f4`): Page background. A faintly warm off-white that separates the page from card surfaces without contrast drama.
- **Surface White** (`#ffffff`): Card backgrounds and primary elevated surfaces.
- **Ghost White** (`#f6f6f7`): Input and secondary-surface background — a step down from pure white without reading as grey.
- **Hairline** (`#ececee`): Borders and dividers. Light enough to be structural rather than decorative.
- **Confirmation Green** (`#2e9e5b`): Success states and confirmed-booking indicators only. It is not part of the brand palette; it appears only as functional feedback.

### Named Rules

**The One Signal Rule.** `#e03939` appears only where action is required or status demands attention. It never decorates a heading, illustrates a section, or fills a background that isn't a hero or alert. Its rarity is the point.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, Impact fallback) — self-hosted at weights 700 and 800
**Body Font:** System UI stack (-apple-system, Segoe UI, Roboto) — no external load

**Character:** Barlow Condensed is industrial and compressed; it reads as muscular without being aggressive. The system UI stack is deliberately neutral — it carries information, not personality. The contrast between the two defines the hierarchy: everything Barlow is a signal, everything system-ui is content.

### Hierarchy

- **Display** (800, 44px/0.98, uppercase, 0em spacing): Hero headings only. At 44px the condensed weight is at its most authoritative. Scales to 34px on narrower hero variants.
- **Headline** (800, 28px/1.05, uppercase, 0.03em): Section h2 dividers. Tight leading and slight tracking makes them scan instantly in a dense mobile layout.
- **CTA** (700, 20px/1, uppercase, 0.08em): Full-width action labels, large button text, slot time display. The 0.08em tracking gives it air at the button padding scale.
- **Body** (400, 16px/1.5): All running text, form labels, card body copy. 16px is the iOS tap-to-zoom threshold — inputs must never go below it.
- **Label** (700, 11px, 0.12em, uppercase): Chip tags, bottom-nav labels, metadata. The heavy tracking at this size makes it feel set rather than small.

### Named Rules

**The Uppercase Display Rule.** Barlow Condensed appears only in uppercase. Its compressed letterforms were designed for signage and sport; mixed-case use weakens both the font and the hierarchy. Use body weight for any text that needs mixed case.

## Layout

The app is mobile-native and single-column. There are no layout breakpoints in the core member app — the design is built for 390px viewport widths and reads acceptably wider without modification. The forms in `f/` share the same token system and add a centred max-width container for desktop use.

Horizontal gutters are 12-16px. Cards use 16px internal padding. Section gaps run 20-26px above major headings (`margin: 26px 0 6px` on h2). Item-level gaps between cards and rows run 10-12px.

The floating bottom nav occupies ~96px at the base of the viewport. The body carries `padding-bottom: calc(96px + env(safe-area-inset-bottom))` to prevent the last card from hiding behind it. All scrollable views account for this.

The hero card sits at the top of each major view section and fills the horizontal width with 24px radius. Quick-action link rows (Find us, Instagram, Website) sit immediately below on the guest home view, using flex with equal-width buttons.

## Elevation & Depth

The system is flat by default. Surfaces exist on two levels: the page background and the card surface. Depth is communicated by the card surface lifting from the background via a hairline border and an almost-invisible shadow, not by tonal layering.

### Shadow Vocabulary

- **Card lift** (`0 1px 3px rgba(20,20,25,.05)`): Applied to cards, stat tiles, pcard, slot rows, and the why-cards. Functions as a separator from the page background, not a suggestion of physical height. Invisible at a glance; meaningful in aggregate.
- **Hero lift** (`0 10px 28px rgba(160,53,53,.28)`): Applied to the hero card only. Red-tinted, dramatically larger — marks the hero as the primary surface on its screen and reinforces the brand's red identity in the shadow itself.
- **Floating nav** (`0 6px 24px rgba(0,0,0,.16)`): The strongest shadow in the system. The nav genuinely floats above scrolling content and the shadow is load-bearing: it must visually separate the nav from whatever colour lands behind it during scroll.

### Named Rules

**The Structural Float Rule.** Shadows live at the composition level — hero, nav, eventually modals. They are not applied as interaction feedback. A card that gains a shadow on hover imports a layering metaphor this system does not use, and it creates false affordance on touch devices where hover states are invisible.

## Shapes

The form language is rounded and consistent. No sharp corners appear anywhere in the system; the degree of rounding signals an element's function.

- **Global card radius** (20px, `--rad`): Cards, pcard, btn rows, slot rows, the why-list items. The default container shape.
- **Hero** (24px): Slightly larger than cards — the hero sits above the card level in hierarchy and its radius reflects that.
- **Floating nav** (22px): Echoes the hero at reduced scale.
- **Stat tile** (16px): Smaller card-like element; slightly more compact rounding matches its density.
- **CTA button** (14px): Full-width primary actions. Tighter than a card to give the action button a distinct form language — it is not a container, it is a prompt.
- **Input** (12px): The most rectilinear element in the system. Form fields are structured and task-oriented; their lower radius signals that.
- **Interactive pill** (999px): All chips, all inline buttons (`.hbtn`, `.btn-small`). The pill immediately reads as "tap me." Everything pill-shaped is interactive; nothing interactive at this scale is non-pill.
- **Icon container** (10-12px): Small square wells inside buttons and list rows that hold an icon in a tinted background.

### Named Rules

**The Graduated Radius Rule.** Radius decreases as an element becomes more structured: hero (24px) > card/row (20px) > CTA button (14px) > input (12px). The pill (999px) lives outside this gradient as a pure interaction signal — it means "this is a button" and nothing else.

## Components

### Buttons

The system has four button shapes serving distinct roles.

**CTA (`.cta`) — the full-width primary action:**
- Shape: 14px radius (`{rounded.cta}`)
- Primary: red background (`#e03939`), white Barlow Condensed uppercase (20px, 0.08em), 15px top/bottom padding
- Hover: deepens to `#a03535`
- Alt variant (`.cta.alt`): white background, 2px inset red border, red text — used when two actions share equal prominence
- Disabled: 45% opacity, `cursor: default`

**Header button (`.hbtn`) — compact top-bar actions:**
- Shape: pill (999px)
- Primary fill: red, white text, 13px system-weight, 10px 16px padding
- Ghost variant: white fill, hairline border, body text colour — for the secondary action when two header buttons appear together

**Small button (`.btn-small`) — inline card-level actions:**
- Shape: pill (999px)
- Red fill, white Barlow Condensed uppercase (15px, 0.08em), 10px 17px padding
- Active: `transform: scale(0.98)`

**Row button (`.btn`) — navigation-list rows:**
- Shape: 20px radius
- White card background, hairline border, card shadow
- 38×38px icon block at left: 11px radius, red-tint background, red icon
- Body-weight label text, 14-16px

### Chips

- Pill, 11px 700 uppercase, 0.12em tracking, 5px 11px padding
- Default: red-tint background (`#fdecec`), red text — category labels, status tags, location tags
- On hero: `rgba(255,255,255,.18)` background, white text — inverts against the red gradient
- Not interactive in the current implementation; purely informational

### Cards / Containers

- **Standard card**: 20px radius, white background, 1px hairline border, card shadow, 16px padding
- **Quote variant** (`.quote`): no border or card; instead a 4px left border in red, 2px 0 2px 14px padding. Relies on indentation rather than a container. Used for member testimonials and contextual notes.
- **Alert/locked variant** (`.gymlock`): red left border, red-tint background — the same spatial grammar as a quote but with fill. Used for access-locked notices.
- **Stat tile**: 16px radius, white, border, shadow. Displayed in a row of three with `flex: 1`.

### Inputs / Fields

- 12px radius, ghost-white background (`#f6f6f7`), 1px hairline border
- Focus: 2px solid red outline, border becomes transparent, background shifts to surface white
- Font size minimum: 16px (prevents iOS auto-zoom on focus — mandatory, never reduce)
- Placeholder text: stone muted (`#66656d`)
- Error state: not yet styled; falls back to browser default

### Navigation

- Floating white pill, fixed to bottom, 12px inset from edges
- 22px radius, `0 6px 24px rgba(0,0,0,.16)`
- 4 tabs: Home, Bookings, Log/Progress, Profile
- Active tab: red icon and label text
- Inactive tab: stone muted icon and text
- Hidden (`display: none`) on unauthenticated views; shown on `.nav.show`

### Slot Row (Signature Component)

The booking slot row is the app's most distinctive recurring pattern. A white card (20px radius, card shadow) with a large Barlow Condensed time label on the left (25px/1, `{typography.cta}` weight) and a status/action block on the right. Status chips (BOOKED, FULL, WAITING) use the chip component in red or muted variants. The action button is `.btn-small`. This pattern repeats in both the gym-slot view and the class timetable.

## Do's and Don'ts

### Do:

- **Do** use Barlow Condensed only in uppercase and only for headings, CTAs, and button labels. It is a display face, not a body face.
- **Do** keep red at a maximum of roughly 10% of any screen's visual area. Every red element costs attention; spend it only on actions and status.
- **Do** use the pill radius (999px) for all chips and all inline buttons. Use `--rad` (20px) for all card-shaped containers. The distinction is not arbitrary — it is the system's primary interactive affordance signal.
- **Do** set input `font-size` to at least 16px. iOS zooms into inputs at smaller sizes; this is a hard requirement for the target audience (members aged 30s–60s, often on older phones).
- **Do** pair a full-width primary CTA with its `.cta.alt` variant when two actions share the same decision weight.
- **Do** use the quote pattern (left red border, no background) for member testimonials and inline notes; use the alert pattern (left border + red-tint background) only for notices that require the member to act.

### Don't:

- **Don't** use Barlow Condensed in mixed case or for body copy. Its compression reads as shouting at running-text weight.
- **Don't** introduce a second accent colour without replacing the existing system through `/impeccable new-work`. One signal colour is load-bearing; two signals create ambiguity about what requires attention.
- **Don't** add hover or focus shadows to cards or list rows. The system's depth model is structural, not interactive. Hover shadows on touch-primary surfaces create a state that most users will never see.
- **Don't** use the hero's red gradient (`linear-gradient(160deg, #e03939, #a03535)`) on any surface other than the top-of-screen hero card. It is a compositional anchor, not a texture.
- **Don't** fabricate prices, plan names, reviews, photos, or booking counts. All content in the app is owner-verified and real. Mark any placeholder content explicitly with square brackets and list it as an owner to-do.
