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
The **old model is gone**. `uiActions` keeps only `TOAST`, which has no equivalent — it is the
backend warning about something, not the mascot acting. `NAVIGATE`, `OPEN_DIALOG` and `HIGHLIGHT`
are now `navigate`, `open_<id>` and `point_at`, which differ in the one way that matters: they tell
the model whether it worked. A `uiAction` went out blind — and that is not theory: we retired the
handling while the backend still had the four server tools that produced it, and the mascot started
answering "there you go, the record is open" with the screen unmoved. The backend retired tools and
emission together (its phase B4) before we removed the handling.

The active patient therefore comes from **`subjectUserId` on the turn**, not from a navigation's
`params.patientId`. Losing it means the mascot keeps working on the wrong record without anyone
noticing, so `mascot-state.subject.spec.ts` guards it.

`pageContext.reachableForms` tells the model which forms the app has and on which screen, whether or
not they are in front of it. It is **derived from the openers**, each of which declares the screen
its button lives on and the server writes it covers — never a parallel table.

Those writes (`tools`) are what turn "prefer the form" into an exact check instead of a guess at
the names. `create_measurement` and `measurement` share a word and the model joined them by itself;
`reschedule_appointment` does not carry the verb in the appointment form's id, and there it went
straight to the confirmation card without even looking. Sending `tools: []` is an **assertion** that
no server write exists for that form — true only of `template` — so a stale name is worse than
none: `write-tools.testing.ts` checks every name we claim against the backend's catalogue, which is
how we found we were still claiming `update_schedule_assignment`, retired versions ago. A table drifts: ours said the appointment form lived
on `PATIENT_APPOINTMENTS`, which routes to the agenda, where there is no button to press at all. The
mascot would navigate there, find nothing and give up — worse than never offering the route. Forms
nothing can open (a menu's meal, renaming, a calendar note) are left out for the same reason.

If the model calls `fill_<id>` for a form that is not open and this screen knows how to open it, the
fill opens it and carries on. Forgetting `open_<id>` is a missing step, not an error; answering
`surface_gone` would send the model off to write behind the person's back. Without it, from the dashboard `fill_measurement` is never declared, so
from where the model stands **the measurement has no form** and the only way it knows to record a
weight is the server's `create_measurement` — the person ends up confirming a card instead of seeing
what gets saved. It was not choosing badly; it was choosing with what we gave it.

A `pendingAction` now only **offers the card**. It no longer sends the mascot off to find the form
by guessing its screen from the tool's name. Reaching a form that is not on screen is the model's
job now: `navigate` to its screen, `open_<id>`, `fill_`, `save_`.

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

**The conversation** lives in `bar/`, which replaced the floating panel entirely — there is no
second chat UI. Closed, all that shows is the mascot in the bottom-right corner, where the chat has
always been. Open, a card grows leftwards from that same corner, so it leaves the form the mascot is
working on visible, which the panel covered.

It is **one card**, not a bar with things stacked on it: what the mascot says, what it is waiting an
answer for, the write it wants confirmed and where you write to it are the same place, because they
are the same conversation. At rest the card shrinks to a pill with only the field. Before anything else it carries the
**consent**: without that yes, `send()` drops the message, so it has to be visible above the field
rather than somewhere the person has to go looking, and the send button stays disabled while it is
pending instead of swallowing what was typed. The greeting and the centre's suggested prompts show
until there is a conversation to show in their place. It opens when you
press the mascot, and by itself whenever something cannot wait — a question, a pending write, a turn
in flight (`MascotStateService.barOpen`).

The card **unrolls from the right**, from where the mascot stands, over 500ms: appearing all at once
gave no clue where it came from. The mascot travels on the same curve and duration, so it reads as
if it were pushing the card open. Neither happens under `prefers-reduced-motion`.

The mascot itself is **not drawn by the bar**: it is the launcher's FAB, which docks astride the
card's left edge, always centred on **the row you type in**. The card is anchored at the bottom and
grows upward, so that row is the one thing that never moves — docking to whatever it happens to be
saying (as alkimia does) had the mascot bobbing up and down with every reply. The point is
*measured* (`bar/bar-dock.ts`, published as `--mascot-dock-*`) rather than worked out from
constants, because the card's width still varies. Keeping one orb is what lets it leave the card to
walk a form, carry its notes and catch dropped files, exactly as before.

**Life and charm** (F7), each piece pure where it can be and silent under `prefers-reduced-motion`:

- `mascot/placement.ts` decides where the mascot stands to work a field: to its left, where it
  covers least; at the *first line* of a tall textarea rather than its middle, which in a ten-line
  field falls well below where the typing is; and out of the way of anything it must not cover — a
  toast, an open dialog. It is geometry only, so the awkward cases are tested without a DOM.
- `copilot/route-veil.ts` veils a page change the mascot makes. A navigation the person asked for,
  they expect; one the model asked for swaps the screen underneath them. The veil gives that half
  second of warning and hides the layout jump of a page mounting. It takes no clicks and never traps
  focus, and if the navigation throws it lifts anyway — a screen left covered is worse than the error.
- `mascot/mascot-follow.ts` has it accompany a change of section: it **looks** at the menu entry that
  was picked, crouches, and jumps when the new screen is in. It crouches *before* it jumps, which is
  what makes it read as a jump and not a bounce. Moving *within* a section — opening a patient's
  record, switching tabs — does not count, or it would hop at every click. It stays out of the way
  while the mascot is working a form: that is where it should be looking.
- `copilot/insert-reveal.ts` brings rows the mascot adds in **one at a time**. Filling a schedule can
  create five at once; arriving together the table jumps and there is no telling what was added or in
  what order.
- `mascot/first-steps.ts` offers three concrete things the first time, filtered by what the person
  may actually do. They **write the draft and do not send it**: an offer that runs itself teaches
  people not to read.
- `mascot/skins/personalities.ts` gives each fruit a character. `agentMotion` already received the
  skin and never used it, so all seven reacted identically — a mascot you can choose that always
  does the same is not a choice, it is a colour. Now the pineapple turns its back instead of showing
  the 💢, the melon just huffs and deflates, the broccoli only blushes. The table is data, not a `switch` in the
  engine, so adding a fruit is one row.
- `mascot/mascot-hero.ts` is the easter egg: Alt plus three clicks and it crouches, takes off and
  **crosses the whole window** — up and away, a beat on the far side, then a dive home — with a cape
  in its fruit's colour. The path is worked out from the window size, not from constants, so it
  crosses the same thing on a laptop and on a large monitor: everything. **One shared gesture, no
  per-skin costume** — seven new drawings to maintain for something almost nobody sees was not worth
  it. The Alt click is caught in the capture phase and stopped, so it never reaches the orb: if it
  opened the conversation the mascot would dock to the card on the first click and the other two
  would land on empty space, which is exactly why it never used to fly. Off with
  `localStorage['mascot-hero'] = '0'`; a backend column to hide a joke would be out of proportion.
- `mascot/mascot-secrets.ts` installs `window.nuti` **only** in dev mode, so setting a skin or
  opening the wardrobe costs one line instead of reproducing a state by hand.

Pressing the mascot **opens** the conversation and never closes it: closing is the fold-away
button's job. Otherwise every press would be a bet on which state it was in, and could throw away a
half-read reply.

Next to the field sit attach, wardrobe and fold-away, and they disappear while it works, when the
only things that matter are pause and stop. The wardrobe icon is drawn inline: `fa-wardrobe` and
`fa-light` are Font Awesome Pro, and this project ships Free, where that class renders nothing.

Pause and stop sit next to what it is doing, not next to what you type, and while it works the
field's placeholder says what you write will be queued. Closing a question with the ✕ answers "no" —
hiding it would leave the turn waiting for an answer nobody can give.

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
  imports feature pages; it reaches screens through `copilot/screen-routes.ts` (the closed list
  `navigate` may go to) and registered surfaces.
