import { TestBed } from '@angular/core/testing';

import { PermissionsService } from '../../../core/permissions/permissions.service';
import { FIRST_STEPS_KEY, FirstStepsService } from './first-steps';

describe('FirstStepsService', () => {
  let allowed: Set<string>;

  const build = () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PermissionsService, useValue: { has: (code: string) => allowed.has(code) } }],
    });
    return TestBed.inject(FirstStepsService);
  };

  beforeEach(() => {
    localStorage.removeItem(FIRST_STEPS_KEY);
    allowed = new Set(['MANAGE_APPOINTMENTS', 'MANAGE_USER', 'MANAGE_MENU']);
  });

  afterEach(() => localStorage.removeItem(FIRST_STEPS_KEY));

  it('la primera vez ofrece tres cosas concretas', () => {
    expect(build().steps().length).toBe(3);
  });

  it('no ofrece lo que esta persona no puede hacer', () => {
    allowed = new Set(['MANAGE_MENU']);
    const steps = build().steps();
    expect(steps.map((step) => step.permission)).toEqual(['MANAGE_MENU']);
  });

  it('se enseñan una vez, y se recuerda entre sesiones', () => {
    const service = build();
    service.dismiss();
    expect(service.steps()).toEqual([]);

    TestBed.resetTestingModule();
    expect(build().steps()).toEqual([]);
  });

  it('cada oferta escribe un borrador, no lo envía', () => {
    for (const step of build().steps()) {
      expect(step.draftKey).toBeTruthy();
      expect(step.draftKey).not.toBe(step.key);
    }
  });
});
