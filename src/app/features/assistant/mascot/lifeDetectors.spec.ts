import { createClickBurstDetector, createPettingDetector } from './lifeDetectors';

describe('createClickBurstDetector', () => {
  it('no dispara hasta la quinta pulsación dentro de la ventana', () => {
    const detector = createClickBurstDetector();

    expect([0, 100, 200, 300].map((time) => detector.press(time))).toEqual([false, false, false, false]);
    expect(detector.press(400)).toBeTrue();
  });

  it('olvida las pulsaciones que quedan fuera de la ventana', () => {
    const detector = createClickBurstDetector();

    detector.press(0);
    detector.press(100);
    detector.press(200);
    detector.press(300);

    expect(detector.press(5000)).toBeFalse();
  });

  it('se reinicia tras la ráfaga', () => {
    const detector = createClickBurstDetector();

    for (const time of [0, 100, 200, 300, 400]) detector.press(time);

    expect([500, 600, 700, 800].map((time) => detector.press(time))).toEqual([false, false, false, false]);
  });
});

describe('createPettingDetector', () => {
  const stroke = (detector: ReturnType<typeof createPettingDetector>, stepMs = 100): boolean => {
    let x = 100;
    detector.move(x, 0);
    for (let index = 1; index <= 8; index += 1) {
      x += index % 2 === 0 ? 20 : -20;
      if (detector.move(x, index * stepMs)) return true;
    }
    return false;
  };

  it('detecta ir y venir rápido sobre la mascota', () => {
    expect(stroke(createPettingDetector())).toBeTrue();
  });

  it('un pase lento no cuenta como mimo', () => {
    expect(stroke(createPettingDetector(), 900)).toBeFalse();
  });

  it('un pase en una sola dirección no cuenta', () => {
    const detector = createPettingDetector();

    let hit = false;
    for (const x of [100, 120, 140, 160, 180, 200]) hit = detector.move(x, 100) || hit;

    expect(hit).toBeFalse();
  });

  it('detecta una caricia vertical: x fija, y yendo y viniendo', () => {
    const detector = createPettingDetector();
    let y = 100;
    let hit = false;
    detector.move(50, 0, y);
    for (let index = 1; index <= 8; index += 1) {
      y += index % 2 === 0 ? 20 : -20;
      hit = detector.move(50, index * 100, y) || hit;
    }

    expect(hit).toBeTrue();
  });

  it('detecta una caricia diagonal', () => {
    const detector = createPettingDetector();
    let x = 100;
    let y = 100;
    let hit = false;
    detector.move(x, 0, y);
    for (let index = 1; index <= 8; index += 1) {
      const step = index % 2 === 0 ? 20 : -20;
      x += step;
      y += step;
      hit = detector.move(x, index * 100, y) || hit;
    }

    expect(hit).toBeTrue();
  });

  it('un recorrido vertical lento no cuenta como mimo', () => {
    const detector = createPettingDetector();
    let y = 100;
    let hit = false;
    detector.move(50, 0, y);
    for (let index = 1; index <= 8; index += 1) {
      y += index % 2 === 0 ? 20 : -20;
      hit = detector.move(50, index * 900, y) || hit;
    }

    expect(hit).toBeFalse();
  });

  it('reset olvida el movimiento acumulado', () => {
    const detector = createPettingDetector();

    detector.move(100, 0);
    detector.move(80, 100);
    detector.reset();

    expect(detector.move(100, 200)).toBeFalse();
  });
});
