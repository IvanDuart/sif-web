import { FormBuilder } from '@angular/forms';

import { reasonRequiredWhenExempt } from './admin-billing-detail.page';

/**
 * Dejar de cobrar a un centro es una decisión que alguien tiene que poder
 * explicar meses después. El backend lo exige con un `400`; aquí se comprueba
 * antes de gastar el viaje.
 */
describe('la exención de un centro', () => {
  const fb = new FormBuilder();

  function group(billingExempt: boolean, reason: string) {
    return fb.nonNullable.group({ billingExempt: [billingExempt], reason: [reason] });
  }

  it('exige un motivo cuando se marca como exento', () => {
    expect(reasonRequiredWhenExempt(group(true, ''))).toEqual({ reasonRequired: true });
  });

  it('no se conforma con espacios en blanco', () => {
    expect(reasonRequiredWhenExempt(group(true, '   '))).toEqual({ reasonRequired: true });
  });

  it('lo da por bueno con un motivo escrito', () => {
    expect(reasonRequiredWhenExempt(group(true, 'Partner'))).toBeNull();
  });

  it('no pide nada si el centro no es exento', () => {
    expect(reasonRequiredWhenExempt(group(false, ''))).toBeNull();
  });
});
