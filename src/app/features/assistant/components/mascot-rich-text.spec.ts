import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MascotRichText } from './mascot-rich-text';
import { parseRichText } from './rich-text.parse';

describe('parseRichText', () => {
  it('marca en negrita lo que va entre dobles asteriscos', () => {
    expect(parseRichText('Tu próximo paciente es **Marge Simpson**, mañana')).toEqual([
      [
        { text: 'Tu próximo paciente es ', bold: false, italic: false, code: false },
        { text: 'Marge Simpson', bold: true, italic: false, code: false },
        { text: ', mañana', bold: false, italic: false, code: false },
      ],
    ]);
  });

  it('acepta guiones bajos dobles, cursiva y código', () => {
    const [line] = parseRichText('__Dieta__ con *fruta* y `kcal`');
    expect(line.map((s) => [s.text, s.bold, s.italic, s.code])).toEqual([
      ['Dieta', true, false, false],
      [' con ', false, false, false],
      ['fruta', false, true, false],
      [' y ', false, false, false],
      ['kcal', false, false, true],
    ]);
  });

  it('anida cursiva dentro de negrita', () => {
    expect(parseRichText('**muy *urgente***')[0]).toEqual([
      { text: 'muy ', bold: true, italic: false, code: false },
      { text: 'urgente', bold: true, italic: true, code: false },
    ]);
  });

  it('no toca los guiones bajos sueltos de identificadores', () => {
    expect(parseRichText('permiso MANAGE_MENU y user_id')[0]).toEqual([
      { text: 'permiso MANAGE_MENU y user_id', bold: false, italic: false, code: false },
    ]);
  });

  it('deja intactos los asteriscos sin pareja', () => {
    expect(parseRichText('2 ** 3 y *suelto')[0]).toEqual([
      { text: '2 ** 3 y *suelto', bold: false, italic: false, code: false },
    ]);
  });

  it('separa el texto por líneas', () => {
    expect(parseRichText('Hola\n**Adiós**').length).toBe(2);
  });

  it('devuelve vacío sin texto', () => {
    expect(parseRichText(null)).toEqual([]);
    expect(parseRichText('')).toEqual([]);
  });
});

@Component({
  standalone: true,
  imports: [MascotRichText],
  template: '<app-mascot-rich-text [text]="value" />',
})
class HostComponent {
  value = '';
}

describe('MascotRichText', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  it('pinta <strong> y no deja asteriscos a la vista', () => {
    fixture.componentInstance.value = 'cita de **Seguimiento** mañana';
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('strong')?.textContent).toBe('Seguimiento');
    expect(host.textContent).toBe('cita de Seguimiento mañana');
    expect(host.textContent).not.toContain('**');
  });

  it('escapa el marcado que venga en el texto', () => {
    fixture.componentInstance.value = '<img src=x onerror="alert(1)"> **ojo**';
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x');
  });

  it('separa las líneas con <br>', () => {
    fixture.componentInstance.value = 'uno\ndos';
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('br').length).toBe(1);
  });
});
