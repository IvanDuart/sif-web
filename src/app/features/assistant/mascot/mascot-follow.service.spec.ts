import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { MascotFillService } from './fill/mascot-fill.service';
import { MascotFollowService, sectionOf } from './mascot-follow.service';
import { REST_POSE } from './mascot-follow';

describe('sectionOf', () => {
  it('la sección es el primer tramo de la ruta', () => {
    expect(sectionOf('/patients')).toBe('patients');
    expect(sectionOf('/users/abc?tab=measurements')).toBe('users');
    expect(sectionOf('/')).toBe('');
  });

  it('moverse dentro de una sección no la cambia', () => {
    expect(sectionOf('/patients')).toBe(sectionOf('/patients/123'));
    expect(sectionOf('/settings?tab=schedules')).toBe(sectionOf('/settings?tab=branding'));
  });
});

describe('MascotFollowService', () => {
  let events: Subject<NavigationEnd>;
  let follow: MascotFollowService;
  let fill: MascotFillService;
  let reduced: boolean;

  const navigate = (url: string) => events.next(new NavigationEnd(1, url, url));

  beforeEach(() => {
    reduced = false;
    events = new Subject<NavigationEnd>();
    spyOn(window, 'matchMedia').and.callFake(() => ({ matches: reduced }) as MediaQueryList);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events, url: '/dashboard' } }],
    });
    follow = TestBed.inject(MascotFollowService);
    fill = TestBed.inject(MascotFillService);
  });

  it('llegar a donde ya estás no salta', fakeAsync(() => {
    navigate('/dashboard');
    tick(0);
    expect(follow.pose()).toEqual(REST_POSE);
  }));

  it('el PRIMER cambio de sección ya salta: la mascota monta con la ruta puesta', fakeAsync(() => {
    // Sin sembrar dónde estamos, éste se perdía: es el primero de la sesión.
    navigate('/patients');
    tick(0);
    expect(follow.pose()).not.toEqual(REST_POSE);
    tick(700);
  }));

  it('al cambiar de sección hace su rutina y vuelve a su sitio', fakeAsync(() => {
    navigate('/patients');
    tick(0);
    expect(follow.pose()).not.toEqual(REST_POSE);

    tick(700);
    expect(follow.pose()).toEqual(REST_POSE);
  }));

  it('moverse dentro de la misma sección no la hace saltar', fakeAsync(() => {
    // Primero el cambio de sección, que sí salta, y se deja terminar.
    navigate('/patients');
    tick(700);
    expect(follow.pose()).toEqual(REST_POSE);

    // Y ahora dentro: abrir una ficha no es cambiar de sección.
    navigate('/patients/123');
    tick(0);
    expect(follow.pose()).toEqual(REST_POSE);
  }));

  it('trabajando no se mete: está en el formulario, no mirando el menú', fakeAsync(() => {
    fill.begin();
    navigate('/patients');
    tick(0);
    expect(follow.pose()).toEqual(REST_POSE);
    fill.end();
    tick(700);
  }));

  it('sin movimiento no hay rutina', fakeAsync(() => {
    reduced = true;
    navigate('/patients');
    tick(0);
    expect(follow.pose()).toEqual(REST_POSE);
    tick(700);
  }));
});
