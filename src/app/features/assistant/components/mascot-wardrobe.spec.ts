import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';

import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { MascotOrb } from './mascot-orb';
import { MascotMoodService } from '../mascot/mascot-mood.service';
import { MascotWardrobe } from './mascot-wardrobe';

/**
 * El escenario del armario: la mascota no es un maniquí dormido. Está viva y,
 * al probarse una fruta, enseña su carácter.
 */
describe('MascotWardrobe: el escenario vivo', () => {
  let fixture: ComponentFixture<MascotWardrobe>;
  let wardrobe: MascotWardrobe;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MascotWardrobe,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        NG_EVENT_PLUGINS,
        {
          provide: TenantContextService,
          useValue: {
            currentTenantId: () => 't1',
            currentMembership: () => ({ tenantId: 't1', roleCode: 'NUTRITIONIST', userType: 'STAFF', permissions: [] }),
            permissions: () => new Set<string>(),
            hasPermission: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MascotWardrobe);
    fixture.detectChanges();
    wardrobe = fixture.componentInstance;
  });

  const model = (): MascotOrb =>
    fixture.debugElement.query(By.css('.wd-model app-mascot-orb')).componentInstance as MascotOrb;

  it('el orbe del escenario está despierto en modo wardrobe', () => {
    expect(model().mode()).toBe('wardrobe');
  });

  it('al probar otra fruta enseña su reacción y luego vuelve a la calma', fakeAsync(() => {
    const other = wardrobe.skins().find((id) => id !== wardrobe.pick())!;

    wardrobe.choose(other);
    fixture.detectChanges();

    expect(wardrobe.previewScene()).toBe('blush');
    expect(model().previewScene()).toBe('blush');

    tick(1800);
    fixture.detectChanges();

    expect(wardrobe.previewScene()).toBeNull();
    expect(model().previewScene()).toBeNull();
  }));

  it('elegir la que ya está puesta no dispara la reacción', () => {
    wardrobe.choose(wardrobe.pick());

    expect(wardrobe.previewScene()).toBeNull();
  });

  it('al probar otra fruta se hunde un instante, con peso físico', fakeAsync(() => {
    const other = wardrobe.skins().find((id) => id !== wardrobe.pick())!;

    wardrobe.choose(other);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.wd-model--dip')).not.toBeNull();

    tick(160);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.wd-model--dip')).toBeNull();
  }));

  it('al confirmar, el escenario celebra y el armario se cierra tras el gesto', fakeAsync(() => {
    let closed = 0;
    wardrobe.closed.subscribe(() => (closed += 1));

    wardrobe.confirm();
    fixture.detectChanges();

    expect(model().mode()).toBe('done');
    expect(TestBed.inject(MascotMoodService).mood()?.kind).toBe('cheer');

    tick(450);
    expect(closed).toBe(1);
  }));

  it('al abrirse lleva el foco a la fruta elegida y al cerrarse lo devuelve al disparador', () => {
    fixture.destroy();

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fixture = TestBed.createComponent(MascotWardrobe);
    fixture.detectChanges();
    TestBed.tick();

    const selected = fixture.nativeElement.querySelector('.wd-thumb--on') as HTMLElement;
    expect(selected).not.toBeNull();
    expect(document.activeElement).toBe(selected);

    fixture.destroy();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  it('Tab y Shift+Tab no salen de la tarjeta', () => {
    const card = fixture.nativeElement.querySelector('.wd-card') as HTMLElement;
    const focusable = Array.from(card.querySelectorAll<HTMLElement>('button:not([disabled])')).filter(
      (element) => element.tabIndex >= 0,
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);

    first.focus();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(last);
  });
});
