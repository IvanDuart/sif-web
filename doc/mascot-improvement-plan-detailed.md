# Plan detallado de mejoras del sistema de mascota — ejemplos de código

> **Fecha:** noviembre de 2026  
> **Alcance:** ejemplos concretos de implementación para las mejoras propuestas en `doc/mascot-improvement-plan.md`.  
> **Convenciones:** Angular 21, standalone components, signals, Taiga UI, Transloco, `localStorage` para preferencias locales.

---

## 1. Introducción

Este documento complementa a `doc/mascot-improvement-plan.md` con **ejemplos de código reales** que muestran cómo integrar cada mejora en la arquitectura actual de sif-web. No son commits listos para producción, sino guías de implementación.

Principios que se siguen:

- No romper la arquitectura de **signals** de Angular.
- No introducir dependencias nuevas si no es necesario.
- Todo texto visible pasa por **Transloco** (`assets/i18n/{es,en}.json`).
- Las preferencias locales viven en `localStorage`, siempre con `try/catch`.
- La proactividad es **opt-out** y respeta frecuencias máximas.

---

## 2. Fase 1 — Nuevas skins y personalidad diferenciada

### 2.1 Añadir una nueva skin

#### Paso 1: registrar el id

`src/app/features/assistant/mascot/skins/types.ts`

```ts
export const SKIN_IDS = ['manzana', 'naranja', 'pina', 'melon', 'frutilla'] as const;
export type SkinId = (typeof SKIN_IDS)[number];
```

#### Paso 2: dibujar el contorno

`src/app/features/assistant/mascot/skins/outlines.ts`

```ts
const STRAWBERRY = blob(
  [58, 90, 28],
  [102, 90, 28],
  [80, 110, 30],
  [80, 70, 22],
);

const DRAWINGS: Record<SkinId, Drawing> = {
  // ... skins existentes
  frutilla: {
    centre: [80, 92],
    inside: STRAWBERRY,
    lit: moved(STRAWBERRY, -8, -10),
    dark: '#b91c3c',
    light: '#e63e5f',
    spot: [54, 64, -30, 42, 74, 1],
    halo: false,
  },
};
```

#### Paso 3: colocar los ojos

`src/app/features/assistant/mascot/skins/faces.ts`

```ts
export const FACES: Record<SkinId, Face> = {
  // ... skins existentes
  frutilla: {
    eyes: [
      [53, 70],
      [90, 70],
    ],
    colour: '#ffffff',
  },
};
```

#### Paso 4: textos

`src/assets/i18n/es.json`

```json
{
  "assistant": {
    "skin_frutilla": "Frutilla",
    "skin_frutilla_desc": "Dulce, atenta y siempre lista para ayudar."
  }
}
```

`src/assets/i18n/en.json`

```json
{
  "assistant": {
    "skin_frutilla": "Strawberry",
    "skin_frutilla_desc": "Sweet, attentive and always ready to help."
  }
}
```

---

### 2.2 Personalidad diferenciada por skin

Actualmente `personaEyes` en `mascot-orb.ts` solo distingue `pina` del resto. Queremos que cada skin reaccione a su manera en `blush` y `angry`.

`src/app/features/assistant/mascot/skins/personality.ts` (nuevo archivo)

```ts
import type { SkinId } from './types';
import type { EyeState } from './faces';

export interface PersonalityEyes {
  blush: EyeState;
  angry: EyeState;
}

export const PERSONALITY_EYES: Record<SkinId, PersonalityEyes> = {
  manzana: {
    blush: { s: 0.85, x: 0, y: 2, look: 'bar' },
    angry: { s: 0.5, x: 0, y: 1, look: 'bar' },
  },
  naranja: {
    blush: { s: 0.9, x: 2, y: 1, look: 'bar' },
    angry: { s: 0.55, x: 0, y: 0, look: 'bar' },
  },
  pina: {
    blush: { s: 0.9, x: 2, y: 1, look: 'bar' },
    angry: { s: 0.5, x: 0, y: 1, look: 'bar' },
  },
  melon: {
    blush: { s: 0.85, x: 0, y: 2, look: 'bar' },
    angry: { s: 0.5, x: 0, y: 1, look: 'bar' },
  },
  frutilla: {
    blush: { s: 0.85, x: 0, y: 2, look: 'bar' },
    angry: { s: 0.45, x: 0, y: 2, look: 'bar' },
  },
};
```

`src/app/features/assistant/components/mascot-orb.ts`

```ts
import { PERSONALITY_EYES } from '../mascot/skins/personality';

// Reemplazar el método personaEyes existente:
private personaEyes(skin: SkinId, kind: 'blush' | 'angry'): EyeState {
  return PERSONALITY_EYES[skin]?.[kind] ?? { s: 0.5, x: 0, y: 1, look: 'bar' };
}
```

---

## 3. Fase 2 — Notas con acciones

Actualmente `MascotNote` solo tiene `title`, `text`, `tone` y `ms`. Añadimos `actions`.

### 3.1 Extender el modelo

`src/app/features/assistant/mascot/mascot-mood.service.ts`

```ts
export interface NoteAction {
  label: string;
  run(): void;
}

export interface MascotNote {
  id: number;
  title?: string;
  text: string;
  tone?: 'neutral' | 'danger' | 'celebrate';
  ms?: number;
  actions?: readonly NoteAction[];
}
```

Ajustar `say` para que una nota con acciones no se cierre sola si no tiene `ms`:

```ts
say(note: Omit<MascotNote, 'id'>): number {
  clearTimeout(this.noteTimer);
  const id = this.nextId++;
  this.note.set({ ...note, id });

  const shouldAutoClose = note.ms !== undefined || !note.actions?.length;
  if (shouldAutoClose) {
    this.noteTimer = setTimeout(() => {
      if (this.note()?.id === id) this.note.set(null);
    }, note.ms ?? NOTE_MS);
  }

  return id;
}
```

### 3.2 Mostrar las acciones en el launcher

`src/app/features/assistant/components/mascot-launcher.ts`

```ts
// En el template, dentro de .mascot-note:
@if (state.note(); as note) {
  <div class="mascot-note" role="status" *transloco="let t">
    @if (note.title) {
      <strong>{{ note.title }}</strong>
    }
    <p>{{ note.text }}</p>

    @if (note.actions; as actions) {
      <div class="mascot-note__actions">
        @for (action of actions; track action.label) {
          <button type="button" tuiButton appearance="primary" size="s" (click)="runAction(action)">
            {{ action.label }}
          </button>
        }
      </div>
    }

    <button
      type="button"
      class="mascot-note__close"
      [attr.aria-label]="t('common.close')"
      (click)="state.dismissNote()"
    >
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
  </div>
}
```

Añadir el handler:

```ts
runAction(action: NoteAction): void {
  action.run();
  this.state.dismissNote();
}
```

Y estilos:

```scss
.mascot-note__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
```

---

## 4. Fase 3 — Tips proactivos conservadores

### 4.1 Servicio de tips

`src/app/features/assistant/mascot-tips.service.ts`

```ts
import { Injectable, inject } from '@angular/core';
import { MascotMoodService, type NoteAction } from './mascot/mascot-mood.service';
import { MascotStateService } from './mascot-state.service';
import { AuthService } from '../../core/auth/auth.service';

export interface MascotTip {
  id: string;
  title: string;
  text: string;
  prompt: string;
  tryLabel: string;
}

const TIP_GAP_MS = 150_000;
const QUIET_AFTER_COPILOT_MS = 60_000;
const TIP_MAX_SHOWS = 3;
const TIP_MS = 14_000;
const STORAGE_KEY = 'mascota-tips';

interface Seen {
  [tipId: string]: { shown: number; tried?: boolean };
}

@Injectable({ providedIn: 'root' })
export class MascotTipsService {
  private readonly mood = inject(MascotMoodService);
  private readonly mascotState = inject(MascotStateService);
  private readonly auth = inject(AuthService);

  private lastTipAt = -Infinity;
  private lastCopilotAt = -Infinity;

  constructor() {
    // Cada vez que el copiloto trabaja, reiniciamos el reloj de silencio.
    this.mascotState.sending;
    // En Angular signals no podemos suscribir directamente sin effect.
    // Se recomienda un effect en un servicio auxiliar o invocar markCopilotUsed() desde el state.
  }

  markCopilotUsed(): void {
    this.lastCopilotAt = Date.now();
  }

  offer(tip: MascotTip, now = Date.now()): boolean {
    if (
      now - this.lastTipAt < TIP_GAP_MS ||
      now - this.lastCopilotAt < QUIET_AFTER_COPILOT_MS ||
      this.isBusy()
    ) {
      return false;
    }

    const seen = this.readSeen();
    const mine = seen[tip.id] ?? { shown: 0 };
    if (mine.tried || mine.shown >= TIP_MAX_SHOWS) return false;

    this.lastTipAt = now;
    this.writeSeen({ ...seen, [tip.id]: { ...mine, shown: mine.shown + 1 } });

    const actions: NoteAction[] = [
      {
        label: tip.tryLabel,
        run: () => {
          this.writeSeen({ ...this.readSeen(), [tip.id]: { ...mine, tried: true } });
          this.mascotState.openPanel();
          // Dejamos el prompt escrito en el input; el panel debería exponer un método para ello.
        },
      },
      {
        label: 'No, gracias',
        run: () => undefined,
      },
    ];

    this.mood.say({
      title: tip.title,
      text: tip.text,
      tone: 'neutral',
      ms: TIP_MS,
      actions,
    });

    return true;
  }

  private isBusy(): boolean {
    return this.mascotState.sending() || this.mascotState.open() || this.mascotState.resolvingAction();
  }

  private readSeen(): Seen {
    try {
      const person = this.auth.user()?.id ?? 'anon';
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Seen>;
      return all[person] ?? {};
    } catch {
      return {};
    }
  }

  private writeSeen(seen: Seen): void {
    try {
      const person = this.auth.user()?.id ?? 'anon';
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Seen>;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [person]: seen }));
    } catch {
      // storage bloqueado: se ofrecerá de nuevo, sin consecuencias graves.
    }
  }
}
```

> **Nota:** `AuthService.user()` debe exponer el `id` del usuario. Si no es así, usar `TenantContextService.currentMembership()` o lo que identifique al usuario actual.

### 4.2 Ejemplo de uso: crear cita manual

`src/app/features/appointments/appointments-list.page.ts` (o donde se detecte la acción)

```ts
import { MascotTipsService } from '../assistant/mascot-tips.service';

export default class AppointmentsListPage {
  private readonly tips = inject(MascotTipsService);

  onAppointmentCreatedManually(): void {
    // Llamar aquí tras guardar una cita creada a mano.
    this.tips.offer({
      id: 'appointment.create',
      title: '¿Sabías que puedo crear citas por ti?',
      text: 'Dime "crea una cita con María mañana a las 10" y lo hago.',
      prompt: 'Crea una cita con ',
      tryLabel: 'Pruébalo',
    });
  }
}
```

### 4.3 Dejar el prompt escrito en el panel

`src/app/features/assistant/mascot-state.service.ts`

```ts
readonly draftMessage = signal<string>('');

openPanelWithDraft(text: string): void {
  this.draftMessage.set(text);
  this.openPanel();
}

// Al abrir, el panel lee este signal.
```

`src/app/features/assistant/components/mascot-panel.ts`

```ts
constructor() {
  effect(() => {
    const draft = this.state.draftMessage();
    if (draft) {
      this.text.set(draft);
      this.state.draftMessage.set('');
      this.input()?.nativeElement?.focus();
    }
  });
}
```

---

## 5. Fase 4 — Detección de usuario atascado en formularios

### 5.1 Servicio

`src/app/features/assistant/stuck-form-offer.service.ts`

```ts
import { Injectable, inject, DestroyRef } from '@angular/core';
import { MascotMoodService, type NoteAction } from './mascot/mascot-mood.service';
import { MascotStateService } from './mascot-state.service';
import { TranslocoService } from '@jsverse/transloco';

const STUCK_MS = 20_000;
const STUCK_GAP_MS = 10 * 60_000;
const OPT_OUT_KEY = 'mascota-stuck-offer';
const ACTIVITY = ['keydown', 'pointerdown', 'input'] as const;
const INVALID = '[aria-invalid="true"], .tui-invalid, [data-invalid="true"]';

@Injectable({ providedIn: 'root' })
export class StuckFormOfferService {
  private readonly mood = inject(MascotMoodService);
  private readonly mascotState = inject(MascotStateService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private lastOffer = -Infinity;
  private readonly offered = new WeakSet<Element>();

  start(): void {
    if (this.isOptedOut()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      const form = this.currentForm();
      if (!form || this.offered.has(form) || !form.querySelector(INVALID)) return;
      if (this.isBusy() || Date.now() - this.lastOffer < STUCK_GAP_MS) return;

      this.offered.add(form);
      this.lastOffer = Date.now();

      const fields = this.invalidFieldNames(form);
      const actions: NoteAction[] = [
        {
          label: this.transloco.translate('assistant.stuck_help'),
          run: () => {
            this.mascotState.openPanel();
            this.mascotState.send(
              this.transloco.translate('assistant.stuck_ask', { fields: fields.join(', ') || '—' })
            );
          },
        },
        {
          label: this.transloco.translate('assistant.stuck_not_now'),
          run: () => undefined,
        },
        {
          label: this.transloco.translate('assistant.stuck_never'),
          run: () => {
            try {
              localStorage.setItem(OPT_OUT_KEY, '1');
            } catch {
              // ignore
            }
          },
        },
      ];

      this.mood.feel('worried', 1600);
      this.mood.say({
        title: this.transloco.translate('assistant.stuck_title'),
        text: this.transloco.translate('assistant.stuck_text'),
        tone: 'danger',
        actions,
      });
    };

    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(check, STUCK_MS);
    };

    for (const type of ACTIVITY) {
      document.addEventListener(type, restart, true);
    }
    document.addEventListener('focusin', restart, true);

    this.destroyRef.onDestroy(() => {
      clearTimeout(timer);
      for (const type of ACTIVITY) {
        document.removeEventListener(type, restart, true);
      }
      document.removeEventListener('focusin', restart, true);
    });
  }

  private currentForm(): Element | null {
    const active = document.activeElement;
    return active?.closest('form, [role="dialog"]') ?? active?.closest('main') ?? null;
  }

  private invalidFieldNames(form: Element): string[] {
    return Array.from(form.querySelectorAll<HTMLElement>(INVALID))
      .map((field) => {
        const input = field as HTMLInputElement;
        return (
          input.labels?.[0]?.textContent ??
          field.getAttribute('aria-label') ??
          field.closest('[data-slot="field"]')?.querySelector('label')?.textContent ??
          ''
        );
      })
      .filter(Boolean)
      .slice(0, 4);
  }

  private isBusy(): boolean {
    return this.mascotState.sending() || this.mascotState.open();
  }

  private isOptedOut(): boolean {
    try {
      return localStorage.getItem(OPT_OUT_KEY) === '1';
    } catch {
      return false;
    }
  }
}
```

### 5.2 Registrar el servicio en el shell

`src/app/layout/shell/shell.ts`

```ts
import { StuckFormOfferService } from '../../features/assistant/stuck-form-offer.service';

export class Shell {
  private readonly stuckOffer = inject(StuckFormOfferService);

  constructor() {
    this.stuckOffer.start();
  }
}
```

### 5.3 Claves i18n

`src/assets/i18n/es.json`

```json
{
  "assistant": {
    "stuck_title": "¿Te atascó el formulario?",
    "stuck_text": "Puedo ayudarte a completar los campos que faltan.",
    "stuck_help": "Ayúdame",
    "stuck_not_now": "Ahora no",
    "stuck_never": "No me lo vuelvas a decir",
    "stuck_ask": "Ayúdame con este formulario. Los campos en error son: {{fields}}."
  }
}
```

---

## 6. Fase 5 — Celebración de logros

### 6.1 Servicio de logros

`src/app/features/assistant/mascot-achievements.service.ts`

```ts
import { Injectable, inject } from '@angular/core';
import { MascotMoodService } from './mascot/mascot-mood.service';
import { AuthService } from '../../core/auth/auth.service';

export type Achievement =
  | 'first_appointment'
  | 'first_menu'
  | 'first_measurement'
  | 'first_patient'
  | 'first_shopping_list';

const STORAGE_KEY = 'mascota-logros';

@Injectable({ providedIn: 'root' })
export class MascotAchievementsService {
  private readonly mood = inject(MascotMoodService);
  private readonly auth = inject(AuthService);

  celebrate(achievement: Achievement): void {
    const person = this.auth.user()?.id ?? 'anon';
    if (!this.firstTime(person, achievement)) return;

    this.mood.feel('cheer');
    this.mood.say({
      titleKey: `assistant.achievements.${achievement}.title`,
      textKey: `assistant.achievements.${achievement}.text`,
      tone: 'celebrate',
      ms: 8000,
    });
  }

  private firstTime(person: string, achievement: Achievement): boolean {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Achievement[]>;
      const done = all[person] ?? [];
      if (done.includes(achievement)) return false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [person]: [...done, achievement] }));
      return true;
    } catch {
      return true;
    }
  }
}
```

> **Nota:** El modelo `MascotNote` actual no tiene `titleKey`/`textKey`. Hay dos opciones:
> 1. Resolver las claves en el servicio con `transloco.translate()` antes de llamar a `say()`.
> 2. Extender `MascotNote` para soportar claves y resolverlas en el componente.
>
> Se recomienda la opción 1 para no complicar el componente.

Opción 1:

```ts
import { TranslocoService } from '@jsverse/transloco';

export class MascotAchievementsService {
  private readonly mood = inject(MascotMoodService);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);

  celebrate(achievement: Achievement): void {
    const person = this.auth.user()?.id ?? 'anon';
    if (!this.firstTime(person, achievement)) return;

    this.mood.feel('cheer');
    this.mood.say({
      title: this.transloco.translate(`assistant.achievements.${achievement}.title`),
      text: this.transloco.translate(`assistant.achievements.${achievement}.text`),
      tone: 'celebrate',
      ms: 8000,
    });
  }
}
```

### 6.2 Emitir logros desde features

`src/app/features/appointments/appointments-list.page.ts`

```ts
import { MascotAchievementsService } from '../assistant/mascot-achievements.service';

export default class AppointmentsListPage {
  private readonly achievements = inject(MascotAchievementsService);

  onAppointmentSaved(): void {
    this.achievements.celebrate('first_appointment');
  }
}
```

### 6.3 Claves i18n

`src/assets/i18n/es.json`

```json
{
  "assistant": {
    "achievements": {
      "first_appointment": {
        "title": "¡Primera cita!",
        "text": "Ya tienes tu primera cita programada."
      },
      "first_menu": {
        "title": "¡Primer menú!",
        "text": "Has creado tu primer menú."
      }
    }
  }
}
```

---

## 7. Fase 6 — Modo héroe (opcional / easter egg)

### 7.1 Servicio

`src/app/features/assistant/mascot/mascot-hero.service.ts`

```ts
import { Injectable, signal, inject } from '@angular/core';
import { MascotLookService } from './mascot-look.service';
import type { SkinId } from './skins/types';

const HERO_KEY = 'mascota-heroe';
const HERO_SELECTION = 'A';

@Injectable({ providedIn: 'root' })
export class MascotHeroService {
  private readonly look = inject(MascotLookService);

  readonly on = signal(this.readHero());
  readonly powering = signal(false);
  readonly pulse = signal(0);

  private armed = false;

  watchSelection(): void {
    const down = () => {
      this.armed = window.getSelection()?.toString().trim() === HERO_SELECTION;
    };
    window.addEventListener('pointerdown', down, true);
  }

  tryToggle(skin: SkinId): boolean {
    const secret = this.armed || window.getSelection()?.toString().trim() === HERO_SELECTION;
    this.armed = false;
    if (secret) {
      window.getSelection()?.removeAllRanges();
      this.toggle(skin);
      return true;
    }
    return false;
  }

  private toggle(skin: SkinId): void {
    const next = !this.on();
    this.on.set(next);
    this.powering.set(next);
    this.pulse.update((p) => p + 1);

    if (next) {
      setTimeout(() => this.powering.set(false), 2600);
    }

    try {
      if (next) localStorage.setItem(HERO_KEY, '1');
      else localStorage.removeItem(HERO_KEY);
    } catch {
      // ignore
    }
  }

  private readHero(): boolean {
    try {
      return localStorage.getItem(HERO_KEY) === '1';
    } catch {
      return false;
    }
  }
}
```

### 7.2 Integrar en el orb

`src/app/features/assistant/components/mascot-orb.ts`

```ts
import { MascotHeroService } from '../mascot/mascot-hero.service';

export class MascotOrb {
  private readonly hero = inject(MascotHeroService);

  // En onClick, antes de emitir activated:
  onClick(): void {
    if (this.decorative() || this.mirror()) return;
    if (this.lifeService.press()) return;
    if (this.hero.tryToggle(this.skin())) return;
    this.activated.emit();
  }
}
```

### 7.3 Dibujar el disfraz

El modo héroe requiere modificar el SVG del orb para superponer un disfraz. La forma más sencilla en la arquitectura actual es añadir un `g` condicional en `mascot-orb.html`:

```html
@if (heroOn()) {
  <g class="mascot-hero-costume">
    <!-- SVG del disfraz para la skin actual -->
  </g>
}
```

Y en `mascot-orb.ts`:

```ts
readonly heroOn = this.hero.on;
```

Por simplicidad, se recomienda implementar primero el disfraz para una sola skin y extender después.

---

## 8. Consideraciones de i18n

Todas las claves nuevas deben añadirse a ambos idiomas. Ejemplo de diff esperado:

```json
{
  "assistant": {
    "stuck_title": "¿Te atascó el formulario?",
    "stuck_text": "Puedo ayudarte a completar los campos que faltan.",
    "stuck_help": "Ayúdame",
    "stuck_not_now": "Ahora no",
    "stuck_never": "No me lo vuelvas a decir",
    "stuck_ask": "Ayúdame con este formulario. Los campos en error son: {{fields}}.",
    "achievements": {
      "first_appointment": { "title": "¡Primera cita!", "text": "Ya tienes tu primera cita programada." },
      "first_menu": { "title": "¡Primer menú!", "text": "Has creado tu primer menú." }
    },
    "skin_frutilla": "Frutilla",
    "skin_frutilla_desc": "Dulce, atenta y siempre lista para ayudar."
  }
}
```

---

## 9. Tests recomendados

Para cada mejora, se propone al menos un test:

### 9.1 Tips

`src/app/features/assistant/mascot-tips.service.spec.ts`

```ts
import { MascotTipsService } from './mascot-tips.service';

describe('MascotTipsService', () => {
  it('no ofrece un tip dos veces seguidas', () => {
    const service = new MascotTipsService(/* mocks */);
    const tip = { id: 'test', title: '', text: '', prompt: '', tryLabel: '' };
    expect(service.offer(tip, 0)).toBe(true);
    expect(service.offer(tip, 0)).toBe(false);
  });

  it('respeta el gap entre tips', () => {
    const service = new MascotTipsService(/* mocks */);
    const tip = { id: 'test', title: '', text: '', prompt: '', tryLabel: '' };
    expect(service.offer(tip, 0)).toBe(true);
    expect(service.offer(tip, 60_000)).toBe(false);
    expect(service.offer(tip, 160_000)).toBe(true);
  });
});
```

### 9.2 Logros

```ts
it('solo celebra el primer logro una vez', () => {
  const service = new MascotAchievementsService(/* mocks */);
  expect(service.firstTime('user-1', 'first_appointment')).toBe(true);
  expect(service.firstTime('user-1', 'first_appointment')).toBe(false);
  expect(service.firstTime('user-2', 'first_appointment')).toBe(true);
});
```

### 9.3 Stuck form offer

```ts
it('detecta campos inválidos', () => {
  // Montar un formulario con un input aria-invalid="true" y simular focus.
});
```

---

## 10. Orden recomendado de implementación

1. **Notas con acciones** — desbloquea tips y stuck form offer.
2. **Tips proactivos** — alto impacto, bajo riesgo.
3. **Stuck form offer** — mejora la experiencia de formularios.
4. **Nuevas skins + personalidad** — mejora la percepción visual.
5. **Logros** — momentos de delight.
6. **Modo héroe** — easter egg opcional.

---

## 11. Conclusión

Los ejemplos anteriores muestran cómo integrar cada mejora respetando la arquitectura actual de sif-web. La clave es avanzar por fases, manteniendo la proactividad bajo control y siempre con opt-out para el usuario. La base técnica (signals, fill, streaming) ya está; el trabajo es añadir capas de producto encima.
