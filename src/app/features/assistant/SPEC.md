---
id: assistant-module
type: module-design
title: assistant — conversational assistant ("mascota")
status: draft
parent: architecture
depends-on: [core-module]
references: [mascota-contract, assistant-contract]
---

# assistant ("mascota")

## Responsibility

This module is a conversational assistant for staff, shown as an animated mascot (orb, panel, action
cards, wardrobe/looks, moods, milestones, tips). It talks to the backend assistant API, which uses
Gemini behind it, through `core/api` (`assistant.api`, `assistant-stream`). The backend contracts
are `mascota-contract` and `assistant-contract`.

Its core rule is **propose, then confirm**. The backend turns a message into a `pendingAction`, and
nothing is written until the user confirms it. On screen, the mascot can *type into* a mounted form
(`mascot/fill/`: `descriptor.ts`, `MascotFillService`, per-form `surfaces/`), but it **never
saves**. The person saves with the form's own button. It never diagnoses, prescribes or interprets
lab results (see `product`).

## Boundary

- **Inbound:** the `Shell` loads the launcher lazily with `import()`. Feature forms register a fill
  surface (a descriptor of their fields) through `MascotFillService`. The registry lives here, not
  in the assistant state, because pages write to it without knowing anything about the
  conversation.
- **Observing writes:** `mascotWritesInterceptor` runs last in the HTTP chain. Successful
  non-assistant writes refresh milestones and tips. It only observes and never alters a request.
- **Outbound:** depends only on `core` (API, tenant context, permissions, UI services). It never
  imports feature pages; it reaches screens through routes (`surfaces/routes.ts`) and registered
  surfaces.
