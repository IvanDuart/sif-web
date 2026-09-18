import { KCAL, sumNutrient } from './food.model';

/**
 * El cálculo local de macros es la única lógica no trivial que corre en el
 * cliente mientras se edita, y es la que tiene que cuadrar con
 * `GET /menu/{id}/nutrition`. Si esto se rompe, el nutricionista pauta con
 * calorías equivocadas.
 *
 * Nota sobre el ejemplo de `doc/menus-estructurados-bedca-frontend.md`: sus
 * números no son consistentes entre secciones (la sección 5 da 111,5679
 * kcal/100 g para el arroz integral hervido y la 6.2 usa 112,5679; ninguna de
 * las dos combinada con 145,0287 del pollo da los 263,69 kcal que afirma —
 * salen 263,29 y 264,09). Por eso aquí se verifica la fórmula con valores
 * controlados en lugar de fijar esa cifra.
 */
describe('sumNutrient', () => {
  const food = (kcal: number, prot?: number) => ({
    nutrients: { [KCAL]: kcal, ...(prot === undefined ? {} : { PROT: prot }) },
  });

  it('escala por 100 g de porción comestible', () => {
    // 200 kcal/100 g a 50 g = 100 kcal.
    const items = [{ food: food(200), quantityG: 50 }];
    expect(sumNutrient(items, KCAL)).toBe(100);
  });

  it('suma varios ingredientes', () => {
    const items = [
      { food: food(100), quantityG: 80 }, // 80
      { food: food(150), quantityG: 120 }, // 180
    ];
    expect(sumNutrient(items, KCAL)).toBe(260);
  });

  it('trata como cero un nutriente que el alimento no declara', () => {
    // Un alimento propio a medio rellenar no debe romper el total, sólo aportar 0.
    const items = [
      { food: food(100, 10), quantityG: 100 },
      { food: food(100), quantityG: 100 },
    ];
    expect(sumNutrient(items, 'PROT')).toBe(10);
  });

  it('ignora las filas sin alimento o sin gramos', () => {
    const items = [
      { food: null, quantityG: 100 },
      { food: food(500), quantityG: null },
      { food: food(100), quantityG: 100 },
    ];
    expect(sumNutrient(items, KCAL)).toBe(100);
  });

  it('devuelve cero con una lista vacía', () => {
    expect(sumNutrient([], KCAL)).toBe(0);
  });
});
