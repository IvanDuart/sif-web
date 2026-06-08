import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { MenuService } from '../../core/api/services/menu.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { Menu } from '../../core/api/models/menu.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { Router } from '@angular/router';
import { MenuFormDialog } from './menu-form.dialog';
import { MenuUploadDialog } from './menu-upload.dialog';
import { EmptyState } from '../../shared/ui/empty-state';

import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-menus-list',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, CardModule, TagModule, IfPermissionDirective, TranslocoDirective, EmptyState],
  templateUrl: './menus-list.page.html'
})
export default class MenusListPage implements OnInit {
  private menuService = inject(MenuService);
  private tenantCtx = inject(TenantContextService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private transloco = inject(TranslocoService);
  
  menus = signal<Menu[]>([]);
  loading = signal(false);
  totalRecords = signal(0);
  
  private lastPage = 0;
  private lastSize = 10;

  ngOnInit() {
    this.loadMenus(0, 10);
  }

  onPage(event: any) {
    this.lastPage = event.first / event.rows;
    this.lastSize = event.rows;
    this.loadMenus(this.lastPage, this.lastSize);
  }

  loadMenus(page: number, size: number) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    
    this.loading.set(true);
    this.menuService.search(tenantId, page, size).subscribe({
      next: (res) => {
        this.menus.set(res.content || []);
        this.totalRecords.set(res.totalElements || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  viewMenu(menu: Menu) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (tenantId) {
      this.router.navigate(['/menus', menu.id]);
    }
  }

  createMenu() {
    const ref = this.dialogService.open(MenuFormDialog, {
      header: 'Crear Menú Manualmente',
      width: '450px',
      modal: true,
      breakpoints: {
        '960px': '75vw',
        '640px': '90vw'
      }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Menú creado correctamente' });
          this.loadMenus(this.lastPage, this.lastSize);
        }
      });
    }
  }

  uploadMenu() {
    const ref = this.dialogService.open(MenuUploadDialog, {
      header: 'Subir Menú (Reconocimiento por IA)',
      width: '550px',
      modal: true,
      breakpoints: {
        '960px': '75vw',
        '640px': '90vw'
      }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.loadMenus(this.lastPage, this.lastSize);
        }
      });
    }
  }

  deleteMenu(menu: Menu) {
    this.confirmationService.confirm({
      message: '¿Estás seguro de que quieres eliminar el menú "' + menu.name + '"?',
      header: this.transloco.translate('common.attention'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.transloco.translate('common.yes'),
      rejectLabel: this.transloco.translate('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.menuService.delete(tenantId, menu.id).subscribe(() => {
            this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'Menú eliminado' });
            this.loadMenus(this.lastPage, this.lastSize);
          });
        }
      }
    });
  }
}
