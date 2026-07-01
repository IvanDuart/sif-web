import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { NotificationService } from '../../core/ui/notification.service';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate } from '../../core/api/models/menu-template.model';

@Component({
  selector: 'app-template-upload',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './template-upload.dialog.html'
})
export class TemplateUploadDialog {
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  readonly context = injectContext<TuiDialogContext<MenuTemplate, void>>();

  name = '';
  description = '';

  cancel() {
    this.context.$implicit.complete();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.templateService.upload(tenantId, file, this.name || undefined, this.description || undefined).subscribe({
      next: (createdTemplate) => {
        this.notify.success('Plantilla extraída y creada correctamente');
        this.context.$implicit.next(createdTemplate);
        this.context.$implicit.complete();
      },
      error: () => {
        input.value = '';
      }
    });
  }
}
