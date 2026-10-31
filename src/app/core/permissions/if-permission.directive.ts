import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { PermissionsService } from './permissions.service';

@Directive({
  selector: '[appIfPermission]',
  standalone: true
})
export class IfPermissionDirective {
  private readonly permissionsService = inject(PermissionsService);
  private readonly templateRef = inject(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);

  /**
   * Código de permiso. Debe ser un `input` signal: el `effect` se ejecuta en el
   * constructor, antes de que Angular asigne un `@Input` tradicional, y con un
   * setter el efecto no volvía a correr al llegar el valor (los botones no
   * aparecían aunque el usuario tuviera el permiso).
   */
  readonly permissionCode = input('', { alias: 'appIfPermission' });

  private hasView = false;

  constructor() {
    effect(() => {
      const hasPermission = this.permissionsService.has(this.permissionCode());
      if (hasPermission && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!hasPermission && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
