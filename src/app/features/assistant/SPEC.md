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

Its core rule is **nothing is written without an explicit yes from the person**. That yes comes
through one of two paths:

- **The backend writes** (`pendingAction`). The model proposes and the person confirms on the
  action card. On the streaming path the card arrives as the `confirm_action` client tool. The
  turn waits for the answer and then continues.
- **The screen writes** (`fill_` + `save_`). The mascot types into a mounted form (`mascot/fill/`).
  It presses the form's own Save button only after the person says yes on its card. The HTTP
  request is the page's own, with the usual permissions and guards. The mascot never calls a
  write endpoint itself.

It never diagnoses, prescribes or interprets lab results (see `product`).

**Client tools** (`copilot/`, contract `assistant-contract` §3.2). On the streaming endpoint, every
turn sends three things:

- `clientTools`: the tools this screen can run, built from the registered surfaces, openers and
  actions.
- `pageContext`: the route, the open forms with their values, and extras.
- The message itself.

The backend can then pause the turn with a `client_tool` event. The browser runs that tool and
returns its result to `POST /runs/{runId}/tool-results`, and the model reads it before going on.
The rules:

- Tool names follow the backend whitelist: `^[a-z][a-z0-9_]{2,48}$`, so surface ids with `-` are
  normalised to `_`.
- Each schema stays at or under 2 KB.
- At most 30 client steps per request.
- `pageContext` sends the values of the forms on screen to the model. Two rules keep it minimal:
  a form can opt out (`FillSurface.contextual`) and then goes as open but without values, which is
  how the anamnesis stays out unless its tab is visible; and a person-picker field is sent as
  the person's name, never as a list of names in the tool declaration (`FillField.people`).
- Writes started by a client tool carry `X-Assistant-Write: <sessionId>`, for tracing only.

The mascot is drawn in **one place only**: the launcher FAB at the bottom. The panel does not repeat
it in the header or beside each message, and the FAB's mode shows thinking, listening and confirm.
On phones the FAB sits small above the panel's top edge instead of hiding. The user can **stop** a
turn while it is being answered. `MascotStateService.stop()` drops the in-flight request. Any text
that already arrived stays, marked as stopped. That turn's `uiActions` and `pendingAction` are never
applied. When a `runId` is known, stopping also sends `DELETE /runs/{runId}`.

## Boundary

- **Inbound:** the `Shell` loads the launcher lazily with `import()`. Feature forms register a fill
  surface (a descriptor of their fields) through `MascotFillService`. The registry lives here, not
  in the assistant state, because pages write to it without knowing anything about the
  conversation.
- **Observing writes:** `mascotWritesInterceptor` runs last in the HTTP chain. Successful
  non-assistant writes refresh milestones and tips. It only observes and never alters a request.
- **Client tools:** `copilot/` builds the catalogue from `MascotFillService`, from the
  `data-mascot-*` attributes in the DOM (`-field`, `-point`, `-submit`) and from screen-declared
  actions. Like the rest of the module, it never imports a feature page.
- **Outbound:** depends only on `core` (API, tenant context, permissions, UI services). It never
  imports feature pages; it reaches screens through routes (`surfaces/routes.ts`) and registered
  surfaces.
