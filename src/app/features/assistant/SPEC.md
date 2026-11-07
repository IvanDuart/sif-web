---
id: assistant-module
type: module-design
title: assistant — conversational assistant ("mascota")
status: draft
parent: architecture
depends-on: [core-module]
references: [mascota-contract, assistant-frontend-contract]
---

# assistant ("mascota")

## Responsibility

This module is a conversational assistant for staff, shown as an animated mascot (orb, panel, action
cards, wardrobe/looks, moods, milestones, tips). It talks to the backend assistant API, which uses
Gemini behind it, through `core/api` (`assistant.api`, `assistant-stream`). The backend contracts
are `mascota-contract` and `assistant-frontend-contract`.

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

**Client tools** (`copilot/`, contract `assistant-frontend-contract` §3.2). On the streaming endpoint, every
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

The catalogue a screen offers is built and dispatched from the same place (`ScreenToolsService`),
so a tool the model was offered is always a tool the browser can run:

- `fill_<id>` writes into a mounted form and answers with `written`, `missing`, `rejected` and
  `missingRequired`. The distinction matters: "I could not find the field" and "the form refused
  the value" are different problems, and only the second one the model can fix by itself.
- `edit_<id>` changes a slice of a long text (`FillField.long`) without the old text passing
  through the model. An anchor that is missing or appears twice is refused (`not_found`,
  `ambiguous`) rather than guessed.
- `open_<id>` presses the screen's own button, so a form only opens where the person could have
  opened it. It is not offered for a form that is already on screen.
- `navigate` goes only to the closed list in `copilot/screen-routes.ts`, and reaches a patient's
  record only when told which patient. `open_` and `navigate` answer with the new catalogue,
  because both change what can be done next.
- While the old model is still live, a turn can carry both a `fill_` and the backend's proposal
  for the same form. The form is filled once: the second one only offers the card.

Everything the mascot waits an answer for goes through **one tray** (`QuestionService`): the write
it proposes (`confirm_action`), a question from the model (`ask_user`) and the warning before
pressing something irreversible. One tray and not one per tool, because two questions at once would
paint over each other and the bottom bar needs a single place to read from. Stopping a turn resolves
whatever was waiting, so a turn never hangs on an unanswered question.

Pointing and pressing (`copilot/pointing.ts`):

- The mascot presses **only** what carries `data-mascot-point`. Marking a control is the screen
  saying "this one may be automated"; a free selector would let the model press anything it can
  name, including what deletes.
- With a dialog open, only the controls inside it are reachable: what is underneath is covered, and
  pressing there would press what the person cannot even see.
- An irreversible action (`data-mascot-danger`, a destructive Taiga appearance, or wording like
  *eliminar* or *dar de baja*) is asked about first, with the control already pointed at.
- If pressing makes the app open **its own** confirmation dialog, the mascot stops there and
  answers `opened_dialog`. It never clicks through a confirmation.
- `action_<id>` is for what a screen knows how to do and no single button covers. The screen
  registers it (`MascotFillService.registerAction`); if it writes to the backend it carries
  `confirm: true` and is asked about like any other write.

`save_<id>` is the tool that actually writes, so it is the strictest one:

- It presses only the form's own Save button (`data-mascot-submit="<surface id>"`), after pointing
  at it and asking, with a summary of what is about to be saved. Without the marker it falls back
  to a `submit` button inside the open dialog, never to "the first primary button on the page".
- If the person presses Save themselves while being asked, that is the yes, already carried out:
  the mascot does not press again.
- Whether it saved is read from **the request**, not from the dialog closing: the clinic settings
  save in place without closing anything, and a save the server rejects closes nothing either.
  `WriteWatchService` records that outcome, fed by `assistantWriteInterceptor`.
- A form can opt out with `FillSurface.noSave`, and then `save_` is not declared for it at all.
  Today: the patient's clinical status (which includes discharging them), appointment types (which
  carry the price), and the patient profile — whose fields live in two places with separate saves,
  so no single button covers what the mascot just wrote. The exclusion lives in the descriptor so
  it travels with the form.

`assistantWriteInterceptor` adds `X-Assistant-Write: <sessionId>` to writes made while a tool is
running. It is tracing only: the request is the page's own, with the same permissions, guards and
backend validation, and the mascot never calls a write endpoint itself.

**The bottom bar** (`bar/`) replaces the floating panel, behind the temporary local flag
`localStorage['mascot-bar']` while both coexist. It is anchored at the bottom, centred, at most
640px wide, and above `--bottom-nav-h` on phones, so it leaves the form the mascot is working on
visible — which the panel covered. The mascot docks at its left edge **and replaces the FAB**: with
the bar on there is one mascot on screen, not two.

- `stripKind()` decides what the status line shows, with a fixed priority: `confirm` > `choice` >
  `paused` > `acting` > `thinking` > `reply`. Anything awaiting an answer wins, because until it is
  answered the turn does not move.
- `readingDoc()` decides what is read rather than heard: a reply of 120 words or more, or one with
  headings, opens in the tray with numbered sections and only its first sentence stays on the bar.
- Messages sent while a turn is running go to `MascotStateService.queued` instead of being dropped.
  Each one can be removed or run with "do this now", which stops the current turn and sends it.
- `CursorService` is **pause**, which is not stop: stop throws the turn away, pause holds the mascot
  between steps and carries on where it was. Runners await it between fields, between tour stops and
  before pressing or saving — never mid-write, since a half-written field would be worse than not
  being able to pause.

**Focus with a dialog open** (verified in `bar/focus-escape.spec.ts`): a `tui-dialog` mounts
`TuiFocusTrap`, which pulls focus back from anything *before* it in the DOM. The bar can still be
typed into because the mascot layer renders outside `tui-root` (`OverlayLayerService`), and the trap
allows what follows it in document order. Moving the mascot inside `tui-root` would silently break
typing in the bar whenever a dialog is open — which is exactly when it is most needed.

The mascot is drawn in **one place only**: the launcher FAB at the bottom (or the bar, when on). The panel does not repeat
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
