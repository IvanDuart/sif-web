import { TestBed } from '@angular/core/testing';

import { CursorService } from './cursor.service';

describe('CursorService', () => {
  let cursor: CursorService;

  beforeEach(() => {
    cursor = TestBed.inject(CursorService);
  });

  it('sin pausa no se espera: se llama entre cada paso', async () => {
    let resumed = false;
    await cursor.whenResumed().then(() => (resumed = true));
    expect(resumed).toBeTrue();
  });

  it('en pausa se espera hasta que se suelta', async () => {
    cursor.pause();
    let resumed = false;
    void cursor.whenResumed().then(() => (resumed = true));

    await Promise.resolve();
    expect(resumed).toBeFalse();

    cursor.resume();
    await Promise.resolve();
    expect(resumed).toBeTrue();
  });

  it('varios pasos esperando se sueltan todos a la vez', async () => {
    cursor.pause();
    let woken = 0;
    void cursor.whenResumed().then(() => (woken += 1));
    void cursor.whenResumed().then(() => (woken += 1));

    cursor.resume();
    await Promise.resolve();
    expect(woken).toBe(2);
  });

  it('el turno que termina no deja a nadie esperando para siempre', async () => {
    cursor.pause();
    let resumed = false;
    void cursor.whenResumed().then(() => (resumed = true));

    cursor.release();
    await Promise.resolve();
    expect(resumed).toBeTrue();
    expect(cursor.paused()).toBeFalse();
  });

  it('reanudar sin pausa no hace nada', () => {
    expect(() => cursor.resume()).not.toThrow();
    expect(cursor.paused()).toBeFalse();
  });
});
