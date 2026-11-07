import { PERSONALITIES, personalityOf } from './personalities';
import { SKIN_IDS } from './types';

describe('las personalidades de las frutas', () => {
  it('todas tienen la suya: una skin sin carácter sería sólo un color', () => {
    for (const id of SKIN_IDS) {
      expect(PERSONALITIES[id]).withContext(id).toBeDefined();
      expect(PERSONALITIES[id].who).withContext(id).not.toBe('');
    }
  });

  it('no todas reaccionan igual, que era justo el problema', () => {
    const contentas = new Set(SKIN_IDS.map((id) => `${PERSONALITIES[id].happy.bits}/${PERSONALITIES[id].happy.move}`));
    const enfadadas = new Set(SKIN_IDS.map((id) => PERSONALITIES[id].angry.move));
    expect(contentas.size).toBeGreaterThan(3);
    expect(enfadadas.size).toBeGreaterThan(3);
  });

  it('las calladas no llevan 💢: enfadarse en bajo también es enfadarse', () => {
    expect(PERSONALITIES['pina'].angry.mark).toBeFalse();
    expect(PERSONALITIES['brocoli'].angry.mark).toBeFalse();
    expect(PERSONALITIES['melon'].angry.mark).toBeFalse();
  });

  it('una skin desconocida no deja a la mascota sin carácter', () => {
    expect(personalityOf('inventada' as never)).toBe(PERSONALITIES['manzana']);
  });
});
