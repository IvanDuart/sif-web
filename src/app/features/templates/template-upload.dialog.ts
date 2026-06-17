import { Component, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { FileUploadModule, FileUpload } from 'primeng/fileupload';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-template-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, InputText, Textarea, FileUploadModule],
  templateUrl: './template-upload.dialog.html'
})
export class TemplateUploadDialog {
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly messageService = inject(MessageService);
  ref = inject(DynamicDialogRef);

  name = '';
  description = '';

  fileUpload = viewChild(FileUpload);

  onUpload(event: { files: File[] }) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const file = event.files[0];
    if (!file) return;

    this.templateService.upload(tenantId, file, this.name || undefined, this.description || undefined).subscribe({
      next: (createdTemplate) => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Plantilla extraída y creada correctamente' });
        this.ref.close(createdTemplate);
      },
      error: () => {
        this.fileUpload()?.clear();
      }
    });
  }
}
