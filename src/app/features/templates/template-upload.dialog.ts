import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiButton, TuiDialogContext, TuiInput } from '@taiga-ui/core';
import { TuiTextarea, TuiInputFiles } from '@taiga-ui/kit';
import { TranslocoPipe } from '@jsverse/transloco';
import { NotificationService } from '../../core/ui/notification.service';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TenantBrandingService } from '../../core/api/services/tenant-branding.api';
import { MenuTemplate } from '../../core/api/models/menu-template.model';

@Component({
  selector: 'app-template-upload',
  standalone: true,
  imports: [FormsModule, TuiButton, TuiInput, TuiTextarea, TuiInputFiles, TranslocoPipe],
  templateUrl: './template-upload.dialog.html'
})
export class TemplateUploadDialog implements OnInit {
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly brandingService = inject(TenantBrandingService);
  private readonly notify = inject(NotificationService);
  readonly context = injectContext<TuiDialogContext<MenuTemplate, void>>();

  name = '';
  description = '';

  aiAvailable = signal<boolean | null>(null);
  isLoadingAiStatus = signal(true);
  isUploading = signal(false);
  selectedFile = signal<File | null>(null);

  hasFile = computed(() => this.selectedFile() !== null);

  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  private readonly VALID_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

  ngOnInit() {
    this.checkAiAvailability();
  }

  private checkAiAvailability() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) {
      this.aiAvailable.set(false);
      this.isLoadingAiStatus.set(false);
      return;
    }

    this.brandingService.getBranding(tenantId).subscribe({
      next: (branding) => {
        this.aiAvailable.set(branding.aiEnabled === true);
        this.isLoadingAiStatus.set(false);
      },
      error: () => {
        this.aiAvailable.set(false);
        this.isLoadingAiStatus.set(false);
      }
    });
  }

  private validateFile(file: File): string | null {
    if (file.size > this.MAX_FILE_SIZE) {
      return 'Archivo demasiado grande (máx 10MB)';
    }
    if (!this.VALID_FILE_TYPES.includes(file.type)) {
      return 'Tipo de archivo no soportado. Usá PDF, JPG o PNG.';
    }
    return null;
  }

  cancel() {
    this.context.$implicit.complete();
  }

  onFileSelected(file: File | null) {
    if (!file) {
      this.selectedFile.set(null);
      return;
    }

    const validationError = this.validateFile(file);
    if (validationError) {
      this.notify.warning(validationError);
      return;
    }

    this.selectedFile.set(file);
  }

  removeFile() {
    this.selectedFile.set(null);
  }

  submit() {
    const file = this.selectedFile();
    const tenantId = this.tenantCtx.currentTenantId();
    if (!file || !tenantId) return;

    this.isUploading.set(true);

    this.templateService.upload(tenantId, file, this.name || undefined, this.description || undefined).subscribe({
      next: (createdTemplate) => {
        this.notify.success('Plantilla extraída y creada correctamente');
        this.context.$implicit.next(createdTemplate);
        this.context.$implicit.complete();
      },
      error: (error: HttpErrorResponse) => {
        this.isUploading.set(false);

        if (error.status === 403) {
          const backendMessage = error.error?.message || '';
          if (backendMessage.includes('AI functionality')) {
            this.notify.error('La funcionalidad de IA no está habilitada para tu cuenta.', 8000);
          } else if (backendMessage.includes('Gemini API key')) {
            this.notify.error('La API Key de Gemini no está configurada. Contactá al administrador.', 8000);
          } else {
            this.notify.error('No tenés permisos para realizar esta acción.');
          }
        } else if (error.status === 400) {
          this.notify.error('Archivo inválido. Subí un PDF o imagen válida.');
        } else if (error.status === 500) {
          this.notify.error('Error del servidor al procesar el archivo. Intentá de nuevo.');
        } else {
          this.notify.error('Error desconocido. Intentá nuevamente.');
        }
      }
    });
  }
}
