import { buildBarChartConfig, buildChartConfig, hexToRgba } from './chart-config';

/**
 * La gráfica de asistencia superpone una línea de objetivo sobre la serie.
 * El detalle frágil es que esa línea de referencia NO se rellene, vaya
 * discontinua y no dibuje puntos; si se rompe, el objetivo tapa la serie.
 */
describe('chart-config', () => {
  it('hexToRgba convierte un hex de marca con alfa', () => {
    expect(hexToRgba('#2F5D4F', 0.28)).toBe('rgba(47, 93, 79, 0.28)');
  });

  describe('buildBarChartConfig', () => {
    it('marca la última barra con el color sólido y el resto translúcidas', () => {
      const config = buildBarChartConfig(['ene', 'feb', 'mar'], {
        label: 'Facturación',
        data: [100, 200, 300],
        color: '#2F5D4F',
        highlightLast: true,
      });

      expect(config.type).toBe('bar');
      expect(config.data.labels).toEqual(['ene', 'feb', 'mar']);
      const backgrounds = config.data.datasets[0].backgroundColor as string[];
      expect(backgrounds.length).toBe(3);
      expect(backgrounds[0]).toBe('rgba(47, 93, 79, 0.28)');
      expect(backgrounds[2]).toBe('#2F5D4F');
      expect(config.data.datasets[0].data).toEqual([100, 200, 300]);
    });
  });

  describe('buildChartConfig', () => {
    it('respeta borderDash, pointRadius y fill de una línea de objetivo', () => {
      const config = buildChartConfig(['ene', 'feb'], [
        {
          label: 'Asistencia',
          data: [88, 90],
          borderColor: '#2F5D4F',
          backgroundColor: '#2F5D4F',
        },
        {
          label: 'Objetivo',
          data: [90, 90],
          borderColor: '#B5892C',
          backgroundColor: '#B5892C',
          fill: false,
          borderDash: [6, 4],
          pointRadius: 0,
        },
      ]);

      expect(config.type).toBe('line');
      const target = config.data.datasets[1];
      expect(target.fill).toBe(false);
      expect(target.borderDash).toEqual([6, 4]);
      expect(target.pointRadius).toBe(0);
      // La serie principal sí dibuja puntos.
      expect(config.data.datasets[0].pointRadius).toBe(4);
    });
  });
});
