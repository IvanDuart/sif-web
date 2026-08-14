# Design System: SIF Web Clinic

## 1. Visual Theme & Atmosphere
A restrained, clean, and clinical interface with a precise daily-app balance. The atmosphere is professional and clinical yet welcoming — characterized by a structured layout, a balanced Emerald + Slate color palette, and clear typography. Layouts are designed to serve data and work, ensuring high efficiency for nutritionists and physiotherapists during patient consultations.

## 2. Color Palette & Roles
- **Canvas Gray** (#F1F5F9) — Primary page background (Dark: #0F172A)
- **Pure Surface** (#FFFFFF) — Card, table wrapper, and dialog fill (Dark: #1E293B)
- **Slate Ink** (#1E293B) — Primary text, headings, and core labels (Dark: #F1F5F9)
- **Muted Steel** (#55657C) — Secondary body text, table headers, descriptions, and labels. Darker than slate-500 so it clears the 4.5:1 AA contrast floor on the Canvas background (Dark: #94A3B8)
- **Whisper Border** (#E2E8F0) — Standard 1px divider and element border (Dark: #334155)
- **Clinic Emerald** (#059669) — Primary accent for active tabs, CTAs, submit buttons, and focus states (Dark: #34D399)
- **Clinic Emerald Hover** (#047857) — Accent hover state (Dark: #6EE7B7)

## 3. Typography Rules
- **Display & Headlines:** Poppins (system-ui fallbacks) — Bold weights (700), track-tight letter-spacing (-0.01em, tightened to -0.02em on H1/H2), balanced line wrapping (`text-wrap: balance`) so headings never orphan words, using a fixed rem scale (not fluid clamp scales) for layout stability.
- **Body & Labels:** System-ui stack — Regular/Medium weights (400/500), line height 1.5, `text-wrap: pretty` on prose to avoid widows, capped at 75ch max-width for prose/descriptions.
- **Mono:** System-ui mono stack — For measurements, body metrics, and tabular values to align data columns correctly.
- **Banned:** Generic serif fonts (such as Times New Roman or Georgia). Serif typography is banned completely. Emojis in labels are also banned.

## 4. Component Stylings
- **Buttons:** Unified using Taiga UI `TuiButton` or `TuiIconButton`. Primary buttons use Emerald fill; secondary buttons use Slate-200 outline/borders. Standardize button heights to size "m" for forms, and size "s" or "xs" for table actions. Flat appearances are reserved for row operations.
- **Tables:** Uniformly styled using Taiga UI `tuiTable`, `tuiTh`, `tuiTr`, and `tuiTd` directives from `@taiga-ui/addon-table`. Hover states should use `#f8fafc` (Dark: rgba(255,255,255,0.03)). Custom `.data-table` native styles are banned.
- **Dialogs:** Custom overrides of `tui-dialog` with 14px border radius. Shadow is tight and tinted to the Slate ramp (never wider than 8px blur, never pure black). Cancel is always on the left (appearance="secondary") and submit on the right (appearance="primary" or default).
- **Inputs:** Wrap all text inputs and textareas in `<tui-textfield>` with `<label tuiLabel>` and `<input tuiInput>` to guarantee standard height, border color, focus ring, and disabled state colors.
- **Badges:** Standardized status badges using Taiga UI `<span tuiBadge>` with `appearance="info"` (role/status), `appearance="positive"` (active/success), `appearance="warning"` (pending/warning), and `appearance="neutral"` (inactive/disabled).
- **Loaders & Skeletons:** Use `boneyard-skeleton` loaders matching the exact dimensions of the content rather than showing page-center circular spinners.

## 5. Layout Principles
- CSS Grid-first layout for cards and dashboards; Flexbox for inline alignment and navigation items.
- Strict single-column collapse on mobile viewports (< 768px). No horizontal overflow is allowed.
- Keep z-index on a semantic scale: dropdowns (100) -> sticky headers (200) -> modals/backdrops (1000/900) -> toasts (1100). Never use arbitrary large values like 999 or 9999.

## 6. Motion & Interaction
- Standard transitions must be fast: 150ms to 200ms maximum, on exponential ease-out curves (`cubic-bezier(0.16, 1, 0.3, 1)`). Animations are purely for state changes (loading, modal enter/leave, list addition/removal), never for page entrance choreography.
- Buttons press with a physical `scale(0.97)` on active; hover/active/focus-visible/disabled states are defined on every interactive element.
- `prefers-reduced-motion` disables transitions and press scaling globally.

## 7. Anti-Patterns (Banned)
- No custom-drawn switch sliders or native checkboxes inside forms where a standard Taiga UI component fits.
- No mixed buttons: do not mix Tailwind `.btn-primary` with Taiga UI `tuiButton`.
- No nested cards: elements should live directly on the main surface cards.
- No "ghost card" surfaces: a 1px border and a soft wide drop shadow are never combined on the same element (cards use border-only, dialogs use a tight tinted shadow).
- No raw emojis in headers or action labels.
