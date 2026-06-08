import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

@Component({
  selector: 'app-tenant-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule],
  templateUrl: './tenant-dashboard.component.html'
})
export class TenantDashboardComponent {
  private tenantCtx = inject(TenantContextService);
  
  tenantName = () => this.tenantCtx.currentMembership()?.tenantName || 'la clínica';
}
