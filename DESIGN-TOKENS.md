# Design Tokens — SIF-WEB UX/UI System

**Last Updated**: August 2026  
**Status**: Production v1  
**Scope**: Tenant-brand-aware design system with fixed semantic status palette

---

## 📋 Overview

This document defines the complete design token hierarchy for sif-web, ensuring consistency, maintainability, and tenant-brand respect across all UI surfaces.

**Key Principle**: A single CSS variable `--brand-primary` (tenant color) drives all brand theming via `color-mix()`. Status colors remain **fixed** (never tenant-driven). All tokens cascade through Tailwind, CSS variables, and Taiga UI with zero duplication.

---

## 🎨 Token Categories

### **Brand Tokens** — Tenant-Configured

| Token | CSS Variable | Tailwind Class | Usage | Example |
|-------|--------------|----------------|-------|---------|
| **Primary** | `--brand-primary` | `bg-primary-500`, `text-primary-500` | CTAs, active states, focus rings | `#059669` (Emerald) |
| **Primary Light** | `--p-primary-50` to `--p-primary-400` | `bg-primary-50` to `bg-primary-400` | Subtle backgrounds, hovers | `color-mix(12%)` |
| **Primary Dark** | `--p-primary-600` to `--p-primary-950` | `bg-primary-600` to `bg-primary-950` | Dark mode ramps | `color-mix(88%, black)` |
| **Contrast Text** | `--p-primary-contrast-color` | `text-primary-contrast` | Text on primary backgrounds | `#ffffff` |

**Dynamic Derivation**: All tints are computed via CSS `color-mix()` — no hardcoded ramps. Light mode: mixes with `white`; dark mode: mixes with `white` or `black` depending on lightness.

---

### **Surface Tokens** — Fixed Slate Palette

| Token | CSS Variable | Tailwind Class | Usage | Light | Dark |
|-------|--------------|----------------|-------|-------|------|
| **Canvas** | `--tui-background` | `bg-surface-0` | Page background | `#f1f5f9` | `#0f172a` |
| **Card** | `--tui-background-elevation-3` | `bg-white` / `dark:bg-surface-900` | Cards, dialogs, elevated surfaces | `#ffffff` | `#1e293b` |
| **Hover** | `--tui-background-neutral-1` | `hover:bg-surface-50` | Table rows, menu items on hover | `#f8fafc` | `#1e293b` |
| **Subtle** | `--tui-background-neutral-2` | `bg-surface-100` | Secondary backgrounds | `#f1f5f9` | `#334155` |

**Principle**: Surface palette is **never tenant-driven**. Maintains clinical UI visual hierarchy regardless of brand choice.

---

### **Brand Tint Utilities** — Derived from `--brand-primary`

Used for decorative or secondary brand surfaces. Always transparent-based to preserve background readability.

| Class | Formula | Usage | Intensity |
|-------|---------|-------|-----------|
| `.bg-brand-tint-02` | `color-mix(in srgb, --brand-primary 2%, transparent)` | Nav bar, dropdowns | Subtle |
| `.bg-brand-tint-04` | `color-mix(in srgb, --brand-primary 4%, transparent)` | Table row hover, menu item hover | Light |
| `.bg-brand-tint-05` | `color-mix(in srgb, --brand-primary 5%, transparent)` | Brand-tinted cards (opt-in) | Light |
| `.bg-brand-tint-08` | `color-mix(in srgb, --brand-primary 8%, transparent)` | Flat button hover, active nav link | Medium |
| `.bg-brand-tint-10` | `color-mix(in srgb, --brand-primary 10%, transparent)` | Secondary button hover, today highlight | Medium |
| `.bg-brand-tint-20` | `color-mix(in srgb, --brand-primary 20%, transparent)` | Pagination active, primary hover bg | Strong |
| `.border-brand-tint-15` | `color-mix(in srgb, --brand-primary 15%, --tui-border)` | Table header border | Strong |
| `.border-brand-tint-20` | `color-mix(in srgb, --brand-primary 20%, --tui-border)` | Brand-tinted card border | Strong |

**Usage Pattern**: Apply via HTML attribute:
```html
<!-- Brand-tinted card (opt-in) -->
<div class="data-card" data-brand-tint>...</div>

<!-- Brand-tinted surfaces in templates -->
<div class="bg-brand-tint-05 rounded-lg p-4">Content</div>
```

---

### **Status Tokens** — Fixed Semantic Palette

**Rule**: Status colors are **never tenant-driven**. They represent universal states across all clinics.

| Status | CSS Variable | Hex | Usage | Semantic Meaning |
|--------|--------------|-----|-------|------------------|
| **Scheduled** | `--status-scheduled` | `#3b82f6` | Appointment booked | Blue — informational |
| **Completed** | `--status-completed` | `#10b981` | Task/visit finished | Green — success |
| **Cancelled** | `--status-cancelled` | `#6b7280` | Cancelled appointment | Gray — neutral/unavailable |
| **No Show** | `--status-no-show` | `#f59e0b` | Patient didn't attend | Amber — warning |
| **Proposed** | `--status-proposed` | `#f97316` | Tentative appointment | Orange — pending |
| **Holiday** | `--status-holiday` | `#dc2626` | Closed day | Red — unavailable |
| **Closed** | `--status-closed` | `#94a3b8` | Closed hours | Gray — unavailable |

**Implementation**: Use utility classes or CSS variables directly:
```html
<span class="bg-status-scheduled">Scheduled</span>
```

---

### **Typography Tokens**

| Category | CSS Variable | Font | Usage |
|----------|--------------|------|-------|
| **Display/Headline** | `--tui-font-heading` | Poppins, 700 | Page titles, section headings, brand text |
| **Body** | `--tui-font-family` | system-ui | Body copy, labels, descriptions |
| **Mono** | — | `font-mono` (Tailwind) | Measurements, codes, technical text |

**Font Stack** (system-ui fallback chain):
```
'system-ui', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
```

---

### **Motion & Animation Tokens** (Phase 5)

| Token | Value | Usage |
|-------|-------|-------|
| `--motion-duration-fast` | `120ms` | Micro-interactions (button press, icon swap) |
| `--motion-duration-base` | `180ms` | Standard transitions (fade, slide, scale) |
| `--motion-duration-slow` | `280ms` | Complex transitions (page load, list stagger) |
| `--motion-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Ease-out-quart (bouncy exit) |
| `--motion-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard easing (symmetric) |

**Reduced Motion**: Under `@media (prefers-reduced-motion: reduce)`, all motion tokens are reset to `0ms`.

---

### **Focus & Accessibility Tokens**

| Element | Focus Ring | Outline Color | Offset |
|---------|-----------|-----------------|--------|
| **Custom Buttons** | `2px solid` | `var(--tui-primary)` | `2px` |
| **Nav Links** | `2px solid` | `var(--tui-primary)` | `2px` |
| **Form Inputs** | `0 0 0 2px` box-shadow | `color-mix(15%, transparent)` | — |
| **Menu Items** | `2px solid` | `var(--tui-primary)` | `-2px` (inset) |

**Rule**: All interactive elements have visible `:focus-visible` rings using tenant primary color.

---

### **Spacing & Sizing Tokens**

| Category | Tailwind Mapping | CSS Basis | Notes |
|----------|------------------|-----------|-------|
| **Padding** | `p-4`, `px-6`, etc. | Tailwind default (0.25rem increments) | — |
| **Gap** | `gap-4`, `gap-2`, etc. | Tailwind default | — |
| **Rounded** | `rounded-lg`, `rounded-2xl` | Tailwind default (8px, 16px, etc.) | Components use 14px / 2xl |
| **Shadow** | `shadow`, `shadow-lg` | Tailwind default | Taiga UI adds custom shadows |
| **Touch Targets** | `min-width: 44px`, `min-height: 44px` | Manual CSS | All interactive elements |

---

## 🎯 Component Token Application

### **Data Card** (`data-card`)

```less
.data-card {
  background: var(--tui-background-elevation-3);  // White/dark surface
  border: 1px solid var(--tui-border);             // Slate border
  border-radius: 14px;
  padding: 1.25rem;
  
  &[data-brand-tint] {
    background: color-mix(in srgb, var(--brand-primary) 5%, var(--tui-background-elevation-3));
    border-color: color-mix(in srgb, var(--brand-primary) 15%, var(--tui-border));
  }
}
```

**Usage**:
```html
<!-- Default card -->
<div class="data-card">...</div>

<!-- Brand-tinted variant -->
<div class="data-card" data-brand-tint>...</div>
```

---

### **Buttons**

| Appearance | Idle | Hover | Active | Focus |
|------------|------|-------|--------|-------|
| **Primary** | `--tui-primary` bg | Shadow 0 4px 12px | Scale 0.97 | Ring: 2px solid |
| **Secondary** | Transparent, `--tui-primary` border | `bg-brand-tint-10` | Scale 0.97 | Ring: 2px solid |
| **Flat** | Transparent | `bg-brand-tint-08`, `--tui-primary` text | Scale 0.97 | Ring: 2px solid |

---

### **Tables** (`table[tuiTable]`)

| Part | Token | Value |
|------|-------|-------|
| **Header Border** | Border bottom | `color-mix(15%, --brand-primary)` |
| **Row Hover** | Background | `color-mix(4%, --brand-primary)` |
| **Row Height (normal)** | Padding | `0.875rem 1rem` |
| **Row Height (compact)** | Padding | `0.625rem 0.75rem` |
| **Sort Icon** | Color | `--tui-primary` (when active) |

---

### **Inputs & Forms**

| State | Background | Border | Text | Focus Ring |
|-------|-----------|--------|------|-----------|
| **Idle** | `--tui-background-neutral-1` | `--tui-border` | `--tui-text-primary` | None |
| **Focus** | `color-mix(3%, --brand-primary)` | `--tui-primary` | `--tui-text-primary` | `0 0 0 2px color-mix(15%, --tui-primary)` |
| **Error** | `#fee2e2` | `#dc2626` | `#1e293b` | `0 0 0 2px rgba(220, 38, 38, 0.2)` |

---

## 📐 Responsive Breakpoints

| Breakpoint | Width | Context | Nav Behavior |
|-----------|-------|---------|--------------|
| Mobile | < 640px | Phone portrait | Hamburger menu, compact tables |
| Tablet | 641px – 1024px | Tablet portrait/small desktop | Nav bar visible, compact mode optional |
| **Tablet Landscape** | **1024px** | Tablet landscape / iPad | **Hamburger threshold** ← Phase 4 change |
| Desktop | > 1024px | Desktop / large tablet | Full nav menu |

---

## 🔄 Token Sync & Drift Detection

### CSS → Tailwind Mapping

`tailwind.config.js` maps CSS variables to Tailwind:
```js
theme: {
  colors: {
    primary: {
      50: 'var(--p-primary-50)',
      500: 'var(--p-primary-500)',  // Always == --brand-primary
      600: 'var(--p-primary-600)',
      // ... etc
    },
    surface: {
      0: 'var(--p-surface-0)',
      50: 'var(--p-surface-50)',
      // ... etc
    }
  }
}
```

**Drift Detection**: If styles.less and tailwind.config.js diverge:
1. Lint will warn on unused Tailwind classes
2. `npm run lint` catches hardcoded hex colors that should be vars

---

## 🧪 Testing Tokens

### Color Contrast Verification

Test matrix: **3 tenant colors × 2 themes × 3 surface types**

```bash
# Tenant colors (examples)
- Emerald: #059669 (default)
- Blue: #2563eb
- Purple: #7c3aed

# Themes
- Light mode: white/slate backgrounds
- Dark mode: dark slate/navy backgrounds

# Surface types
1. Primary button text on button bg
2. Secondary button text on button bg
3. Status badge text on status badge bg
```

**Minimum WCAG AA**: 4.5:1 contrast ratio for all combinations.

---

## 📖 Component-Specific Guidelines

### **Dashboard KPI Cards**

```html
<div class="data-card" data-brand-tint>
  <!-- Brand tint applied to card bg + border -->
  <div class="flex items-center gap-4">
    <div class="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/40">
      <!-- KPI icon background -->
    </div>
    <div class="flex-1">
      <h3 class="font-display text-lg font-bold">KPI Title</h3>
      <p class="text-sm text-surface-600">Subheading</p>
    </div>
  </div>
</div>
```

### **Appointment Calendar**

```html
<div class="fc">
  <!-- FullCalendar with tenant-aware styling -->
  <!-- Today: bg-brand-tint-10, text-primary -->
  <!-- Event border: 3px solid --tui-primary -->
  <!-- Buttons: hover uses bg-brand-tint-4, active uses bg-brand-tint-8 -->
</div>
```

### **Patient List Table**

```html
<table tuiTable>
  <!-- Header border: brand-tint-15 -->
  <!-- Row hover: bg-brand-tint-4 -->
  <!-- Sticky first column: shadow on scroll -->
  <!-- Density toggle: .table-density-compact applies tighter padding -->
</table>
```

---

## ⚠️ Anti-Patterns

### ❌ **Don't**

- Hardcode hex colors (use `var(--*)` or Tailwind classes)
- Make status colors dynamic (always use fixed `--status-*`)
- Use `!important` in design token CSS (use cascade instead)
- Mix Tailwind color classes with CSS var colors
- Apply tenant color to borders, text, or bg that should stay neutral (e.g., status labels)

### ✅ **Do**

- Use Tailwind classes for spacing, sizing, layout
- Use CSS variables for colors, fonts, motion
- Derive all brand surfaces from `--brand-primary` via `color-mix()`
- Test color contrast on tenant color changes
- Use `data-brand-tint` opt-in for secondary brand surfaces
- Document component token usage in Storybook

---

## 📝 Maintenance

### When to Update This Document

- [ ] New design token added (e.g., new spacing scale)
- [ ] Taiga UI or Tailwind version upgraded (breaking changes)
- [ ] Tenant color derivation algorithm changes
- [ ] New component pattern established (add to "Component-Specific Guidelines")
- [ ] Motion or animation tokens adjusted

### Review Checklist

- [ ] All CSS variables documented
- [ ] All Tailwind mappings current
- [ ] Contrast verified for 3+ tenant colors
- [ ] Focus ring styles complete
- [ ] Motion tokens tested with `prefers-reduced-motion`
- [ ] Responsive breakpoints match implementation
- [ ] Component examples up-to-date

---

## 🔗 Related Files

- `src/styles.less` — Token definitions & layer utilities
- `tailwind.config.js` — Tailwind color mappings
- `src/app/core/branding/theme.service.ts` — Runtime tenant color application
- `src/app/layout/shell/shell.scss` — Component-specific overrides
- `.storybook/` — Component stories with token preview

---

**Last Reviewed**: August 2026  
**Next Review**: Q4 2026 (after Phase 7 Storybook launch)
