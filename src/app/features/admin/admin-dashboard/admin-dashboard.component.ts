import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TuiTable } from '@taiga-ui/addon-table';
import { TenantService } from '../../../core/api/services/tenant.api';
import { Tenant } from '../../../core/api/models/tenant.model';
import { Page } from '../../../core/api/models/page.model';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService, ModalService } from '../../../core/ui';
import { EmptyState } from '../../../shared/ui/empty-state';
import { CreateTenantDialog } from '../create-tenant.dialog';
import { formatInstant } from '../../../shared/utils/date';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [TranslocoDirective, TuiButton, TuiBadge, TuiTable, EmptyState],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly authService = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  tenants = signal<Tenant[]>([]);
  loading = signal(false);
  totalRecords = signal(0);

  protected readonly formatInstant = formatInstant;

  ngOnInit() {
    this.loadTenants();
  }

  loadTenants() {
    this.loading.set(true);
    this.tenantService.search(0, 100).subscribe({
      next: (res: Page<Tenant>) => {
        this.tenants.set(res.content || []);
        this.totalRecords.set(res.page?.totalElements || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  showCreateDialog() {
    this.modal.open<Tenant | null, void>(CreateTenantDialog, {
      label: this.transloco.translate('admin.create_tenant'),
      size: 'm',
    }).subscribe((created) => {
      if (created) {
        this.notify.success(this.transloco.translate('admin.created_success'));
        this.handleTenantCreated(created);
      }
    });
  }

  private async handleTenantCreated(created: Tenant) {
    const user = await this.authService.refreshUser();
    const membership = user?.memberships?.find(m => m.tenantId === created.id);
    if (membership) {
      this.authService.switchTenant(membership);
      this.router.navigate(['/dashboard']);
    } else {
      this.loadTenants();
    }
  }
}
