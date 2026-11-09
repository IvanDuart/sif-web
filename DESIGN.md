---
name: SIF Web Clinic
description: A warm, precise operating system for nutrition clinics.
colors:
  canvas: "#FBFAF8"
  surface: "#FFFFFF"
  sunken: "#F4F2EE"
  line: "#EAE7E1"
  line-strong: "#D8D4CC"
  ink: "#1F1D1A"
  ink-2: "#6B665E"
  ink-3: "#6E6960"
  primary: "#2F5D4F"
  primary-hover: "#295246"
  primary-soft: "#EAEFED"
  on-primary: "#FFFFFF"
  accent-text: "#23453A"
  accent: "#B04A06"
  accent-soft: "#FAF0EA"
  ok: "#2D7A5F"
  ok-soft: "#E6EFEC"
  warn: "#B5892C"
  warn-soft: "#FBF4E6"
  warn-text: "#8A6414"
  err: "#B04A3E"
  err-soft: "#FBF0EE"
  err-text: "#B04A3E"
  info: "#3C6E96"
  canvas-dark: "#1A1917"
  surface-dark: "#232120"
  sunken-dark: "#2B2927"
  line-dark: "#38352F"
  ink-dark: "#F4F2EE"
  ink-2-dark: "#B4AEA4"
  ink-3-dark: "#969188"
  primary-dark: "#5D8176"
  primary-soft-dark: "#262E2A"
  accent-text-dark: "#8BA49C"
  accent-dark: "#E08A5C"
  err-text-dark: "#E59A8E"
typography:
  display:
    fontFamily: "Satoshi, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Satoshi, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Satoshi, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  meta:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.78125rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  field: "16px"
  pill: "999px"
spacing:
  "2xs": "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "32px"
  page: "40px"
  page-mobile: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "2px 16px"
    height: "44px"
  chip-neutral:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "2px 16px"
    height: "44px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "56px"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    width: "560px"
---

# Design System: SIF Web Clinic

## Overview

**Creative North Star: "The Quiet Clinic"**

The interface behaves like a well-run consultation room: warm paper surfaces, one accent that means "act or choose", and enough quiet for clinical data to be the loudest thing on screen. Warmth lives in the neutrals, the type and the spacing — never in decoration. A nutritionist should be able to read a patient's state, today's agenda and the next action in one pass, then stop thinking about the interface.

The visual world is a warm-neutral ramp (canvas, surface, sunken, ink) with a single tenant-owned accent. Every shade of that accent is derived from one anchor, and text on it follows a tenant-aware pair: white in light-mode controls by brand decision, computed on-accent in dark mode and on non-button surfaces. Structure comes from 1px hairline borders and tonal layering; shadows are reserved for things that actually float. Typography pairs Inter for the work with Satoshi for titles: a clinical, slightly editorial voice without a serif or a second UI family.

This is an Operate surface. Restraint, scanability and repeatable roles outrank expression. The brand appears in precise details — the accent, the display face, the way a tenant's color tints a card — not in gradients, oversized headlines or decorative color.

**Key Characteristics:**
- Warm-neutral, border-led surfaces; no shadows at rest.
- One tenant accent for action, selection and state; text on it always gets a computed contrast pair.
- Satoshi for display, Inter for everything else, tabular numerals for clinical data.
- A hard 11.5px text floor and a 14px body role.
- Responsive by structure: sidebar → icon rail → bottom nav + sheet; tables scroll inside their frame.

## Colors

A warm neutral spine carries the work; a single tenant accent and a small semantic set do the talking. No gradients, no decorative color, no pure black.

### Primary
- **Clinic Green** (#2F5D4F default, tenant-configurable): primary actions, active navigation, selection, focus. The full 50–950 ramp is derived from `--brand-primary` with `color-mix`, so a tenant color repaints every shade. In light mode, **accent-filled controls intentionally use white**; `on-primary` is the computed pair used in dark mode and on non-button accent surfaces (avatars, skip link, chat bubbles).
- **Deep Green** (#295246): the hover/active step for primary fills.
- **Soft Green** (#EAEFED): the active navigation pill and quiet brand tint on light surfaces.

### Secondary
- **Burnt Ember** (#B04A06): the warm accent reserved for "now" (today, current time), soft notices, avatar initials and small emphasis. It is not a second primary action.
- **Ember Soft** (#FAF0EA): the paired surface for that accent.

### Neutral
- **Warm Paper** (#FBFAF8): the page canvas; never pure white.
- **Pure Surface** (#FFFFFF): cards, tables, dialogs and header rows.
- **Warm Sunken** (#F4F2EE): secondary fills, row hover, neutral chips.
- **Hairline** (#EAE7E1) / **Strong Hairline** (#D8D4CC): 1px separators and control borders.
- **Ink** (#1F1D1A): primary text; near-black, never #000.
- **Muted Ink** (#6B665E): secondary text that still needs AA.
- **Tertiary Ink** (#6E6960): the lowest text role; still 4.5:1 on canvas and surface.
- Dark mode is a composed warm inverse — canvas #1A1917, surface #232120, sunken #2B2927, ink #F4F2EE, tertiary #969188 — not a mechanical invert.

### Status
- **Clinic Green** (#2D7A5F) / **Warm Amber** (#B5892C) / **Brick** (#B04A3E) / **Deep Blue** (#3C6E96) appear only as success, warning, error and information.
- Each has a soft surface and a text-safe variant: `warn-text` (#8A6414) clears 4.5:1 on its own soft fill; `err-text` and the dark-mode equivalents (#E59A8E) do the same. Filled status bars use `on-warn` / `on-err`, computed to sit on the solid color rather than assuming white.

**The One Accent Rule.** The tenant accent is earned: action, selection, current state and focus. It never decorates illustrations, borders or backgrounds "for brand".

**The Contrast Pair Rule.** Light-mode accent controls use white by brand decision — including light tenant accents, where contrast is accepted below AA. Everywhere else (dark mode, avatars, skip link, chat, status fills) the computed `on-*` pair governs.

**The Warm Ink Rule.** Text is warm near-black, never #000; surfaces are warm paper, never cold slate. The two exceptions are pure white cards and the accent itself.

## Typography

**Display Font:** Satoshi (with `system-ui, sans-serif`) — the committed variant "c" of the clinic design guide, weight 700 at `-0.02em`.
**Body Font:** Inter (with `system-ui, sans-serif`) — 400/500 for every interface role.
**Data:** Inter with `font-variant-numeric: tabular-nums` for ages, prices, measurements and table figures.

**Character:** Inter keeps the clinical work neutral and legible; Satoshi gives titles a slightly editorial, human edge without introducing a second UI voice. The pairing is calm, not decorative: no serif, no all-caps display, no letter-spaced marketing type.

### Hierarchy
- **Display** (700, 2rem/1.25, -0.02em; 1.625rem on phones): page titles only. Balanced wrapping.
- **Headline** (700, 1.1875rem/1.2): card and dialog titles.
- **Title** (700, 1.125rem/1.2): subsections and named blocks.
- **Body** (400, 0.875rem/1.43): tables, forms, lists and prose. Dense by design; prose is capped around 45–75ch.
- **Meta** (400, 0.8125rem/1.43): timestamps, counts, helper text and secondary values.
- **Label** (500, 0.78125rem/1.4, optional uppercase): table headers, badges, section labels and navigation captions. Bottom-nav labels are 11.5px.

**The 11.5px Floor.** No readable text goes below 11.5px. The only smaller marks are icons and SVG diagram units that scale up in the viewBox.

**The Two-Voice Rule.** Satoshi for display/headings, Inter for everything that is read or operated. Do not introduce a third family or a serif display face.

**The Tabular Rule.** Numerical data — money, age, measurements, counts, dates in columns — uses tabular numerals so columns align.

## Layout

The shell is a fixed side rail plus a single scrolling content column. Desktop uses a 244px sidebar; 768–1080px collapses it to a 72px icon rail (labels hidden, native `title` for mouse); ≤767px switches to a 60px bottom navigation plus a "Más" sheet for the rest. Content is capped at 1500px and left-aligned beside the rail; padding is 28px × 40px on desktop and 20px × 16px on phones.

Settings use a master–detail split (236px tab column + content at ≥1024px) that becomes wrapping pills below that. Data tables keep their own horizontal scroll inside their frame; the document itself never scrolls sideways. Forms collapse to one column; dialogs become full-screen sheets below 768px. Breakpoints follow the content: 640, 768, 1024 and 1080.

**The One Scroll Rule.** Only the page content scrolls (and tables inside their own frame). The shell, rail, headers and bottom navigation stay put; nothing may introduce a horizontal document scrollbar.

## Elevation & Depth

Depth is tonal and linear, not shadowed. Cards, tables and dialogs separate from the canvas with a 1px hairline and a radius; only elements that genuinely float — dialogs, dropdowns, toasts and the assistant — carry `--shadow-float` (`0 1px 2px rgba(31,29,26,.04), 0 8px 24px rgba(31,29,26,.06)`). There is no glass, blur, neon glow or wide halo. In dark mode the same rule holds with a deeper shadow tint.

Motion is short and state-led: 120ms fast, 180ms base, 280ms slow, on `cubic-bezier(0.16, 1, 0.3, 1)`. The one exception is the mobile "Más" drag-to-dismiss, which uses a velocity-projected spring because it is gesture feedback, and is skipped under `prefers-reduced-motion`.

**The Border-Not-Shadow Rule.** A surface at rest gets a 1px border, never a border plus a wide soft shadow. If it floats, it gets the float shadow and no border drama.

## Shapes

A compact, softly-curved form language: 8px for navigation items and icon surfaces; 12px for buttons, chips, cards, dialogs and dropdowns; 16px for text fields; 999px for badges, avatars and count pills. Borders are always 1px hairlines. There are no nested cards, no thick side-accent borders, and no arbitrary radii outside this scale.

**The No-Nested-Card Rule.** A card never contains another card. Use spacing, a tonal fill, or a divider inside the existing surface instead.

## Components

### Buttons
- **Shape:** 12px radius, 44px height, 6px × 16px padding, 16px/700.
- **Primary:** tenant accent fill; light mode writes white (brand decision). Dark mode uses the computed `on-primary` pair (near-black on a light accent). Hover darkens to `primary-hover`.
- **Secondary:** warm sunken fill with accent text; no visible border at rest. Used for "Exportar", "Cancelar" and secondary actions.
- **Flat / icon:** reserved for row actions and dense toolbars; hover is an 8% tenant tint. Icon buttons get a 44px square target on coarse pointers.
- **Focus:** 2px visible ring in the tenant accent; never removed.

### Chips
- **Style:** Taiga `tuiChip` at size m: 44px tall, 12px radius, 2px × 16px padding, 16px text.
- **State:** selected chips use the accent fill + computed on-accent text; neutral chips use sunken + ink. Counts are full-opacity, never dimmed below AA.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** pure surface on the warm canvas.
- **Border:** 1px hairline; no rest shadow.
- **Internal Padding:** 20px (page cards), 16px in dense lists.
- **Brand tint:** opt-in cards mix 5% tenant color into the surface and border (10%/22% in dark).

### Inputs / Fields
- **Style:** Taiga `tui-textfield` with a visible `tuiLabel`; 56px height, 16px radius, 16px text, surface fill.
- **Focus:** Taiga focus ring in the tenant accent; invalid fields use the error color and a `tui-error` message.
- **Affordance:** every input has a label; placeholders are hints, not labels.

### Navigation
- **Desktop:** 244px sidebar, 14.5px labels, 8px radius active pill with `primary-soft` + `accent-text`, 39–44px rows.
- **Tablet:** 72px icon rail, 44px targets, native `title` tooltips.
- **Mobile:** 60px bottom nav with five destinations and 11.5px labels; the rest live in the "Más" sheet (modal: inert background, scroll lock, focus in/out).
- **State:** active destinations carry `aria-current="page"`; the active label uses the contrast-safe accent text, not the raw fill color.

### Tables
- Taiga `tuiTable` / `tuiTh` / `tuiTr` / `tuiTd` only. Headers 12.5px/500, cells 14px/400 with 13px × 16px padding; row height ≈ 63px. All numbers tabular; the age column never wraps. The table frame scrolls horizontally on narrow screens; the page does not.

### Dialogs
- 12px radius, surface fill, `shadow-float`, size m = 560px, full-screen below 768px, Cancel on the left (secondary) and the primary action on the right. While open, the page content is `inert` and focus returns to the trigger on close. Primary text uses the computed on-accent pair.

### Badges
- Taiga `tuiBadge` only: `info` for role/status, `positive` for active/success, `warning` for pending, `neutral` for inactive. Badges are text, not color-only codes.

### Empty States
- A centered 64px tonal icon tile, an `h2`, a short description capped near 45ch, and an optional primary action. The empty state is a section, not a card inside a card.

### Assistant (signature)
- The mascot is a global layer mounted outside `tui-root` so it can work above dialogs; it travels to the field it is filling and never writes without confirmation. Its motion is playful only in the assistant layer; the rest of the interface stays reserved.

## Do's and Don'ts

### Do:
- **Do** use Taiga UI v5 for every button, input, badge, chip, table and dialog; the custom layer is for layout and tokens, not replacement controls.
- **Do** derive every accent shade from `--brand-primary` and let the theme service compute on-accent text for each tenant.
- **Do** keep the accent for action, selection, current state and focus; let warm neutrals carry the rest. In light mode, accent controls write white; in dark mode they use the computed pair.
- **Do** separate surfaces with a 1px hairline and reserve `shadow-float` for dialogs, menus, toasts and the assistant.
- **Do** keep body text at 14px, labels at 12.5px and nothing readable below 11.5px; use tabular numerals for data.
- **Do** keep the content within 1500px and let tables scroll inside their frame rather than the page.

### Don't:
- **Don't** use the computed dark text on light-mode primary controls; white is the committed light-mode label. Reserve the computed pair for dark mode and non-button accent surfaces.
- **Don't** mix Tailwind buttons or native inputs with Taiga components, and don't nest cards.
- **Don't** use pure black or cold slate; the system is warm-neutral.
- **Don't** use gradients, glass, wide soft shadows or decorative blur.
- **Don't** use the accent as a second primary or as decoration on borders and illustrations.
- **Don't** put readable text below 11.5px, shrink a text role to fit, or use color alone to communicate state.
