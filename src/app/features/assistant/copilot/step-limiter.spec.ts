import { MAX_STEPS_PER_REQUEST, StepLimiter } from './step-limiter.service';

describe('límite de pasos por petición', () => {
  it('permite 30 y niega el siguiente', () => {
    const limiter = new StepLimiter();
    for (let i = 0; i < MAX_STEPS_PER_REQUEST; i += 1) expect(limiter.take()).toBeTrue();
    expect(limiter.take()).toBeFalse();
    expect(limiter.used()).toBe(MAX_STEPS_PER_REQUEST);
    expect(limiter.exhausted()).toBeTrue();
  });

  it('se reinicia con cada mensaje', () => {
    const limiter = new StepLimiter();
    limiter.take();
    limiter.reset();
    expect(limiter.used()).toBe(0);
    expect(limiter.exhausted()).toBeFalse();
  });
});
