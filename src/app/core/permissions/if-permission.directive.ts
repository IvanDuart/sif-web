import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { PermissionsService } from './permissions.service';

@Directive({
  selector: '[appIfPermission]',
  standalone: true
})
export class IfPermissionDirective {
  private permissionsService = inject(PermissionsService);
  private templateRef = inject(TemplateRef);
  private viewContainer = inject(ViewContainerRef);

  private hasView = false;
  private permissionCode = '';

  @Input() set appIfPermission(permission: string) {
    this.permissionCode = permission;
  }

  constructor() {
    effect(() => {
      const hasPermission = this.permissionsService.has(this.permissionCode);
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
