import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TenantDashboardComponent } from '../tenant/dashboard/tenant-dashboard.component';
import PatientsListPage from '../patients/patients-list.page';
import StaffListPage from '../staff/staff-list.page';
import MenusListPage from '../menus/menus-list.page';
import TemplatesListPage from '../templates/templates-list.page';
import AppointmentsPage from '../appointments/appointments.page';
import UserDetailPage from '../users/user-detail.page';
import MenuDetailPage from '../menus/menu-detail.page';
import TemplateDetailPage from '../templates/template-detail.page';

import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { AppointmentService } from '../../core/api/services/appointment.api';
import { MenuService } from '../../core/api/services/menu.api';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import { TenantService } from '../../core/api/services/tenant.api';
import { PatientEventService } from '../../core/api/services/patient-event.api';
import { MealService } from '../../core/api/services/meal.api';
import { TenantBrandingService } from '../../core/api/services/tenant-branding.api';
import { ShoppingListService } from '../../core/api/services/shopping-list.api';

import { of, NEVER } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-sandbox',
  standalone: true,
  imports: [
    TenantDashboardComponent,
    PatientsListPage,
    StaffListPage,
    MenusListPage,
    TemplatesListPage,
    AppointmentsPage,
    UserDetailPage,
    MenuDetailPage,
    TemplateDetailPage
  ],
  templateUrl: './sandbox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: ActivatedRoute,
      useValue: {
        snapshot: {
          paramMap: {
            get: (key: string) => 'mock-id'
          }
        },
        queryParams: of({})
      }
    },
    { 
      provide: AuthService, 
      useValue: { user: () => ({ id: 'mock-user-123' }) } 
    },
    { 
      provide: TenantContextService, 
      useValue: { 
        currentMembership: () => ({ tenantName: 'Clínica Sandbox' }),
        hasPermission: () => true,
        currentTenantId: () => 'mock-tenant-123'
      } 
    },
    {
      provide: UserTenantRoleService,
      useValue: {
        getUsersByTenantAndType: () => NEVER,
        getUser: () => NEVER,
        getPatientProfile: () => NEVER
      }
    },
    {
      provide: AppointmentService,
      useValue: {
        getByNutritionist: () => NEVER,
        getByPatient: () => NEVER
      }
    },
    {
      provide: MenuService,
      useValue: {
        searchByUser: () => NEVER,
        history: () => NEVER,
        getById: () => NEVER
      }
    },
    {
      provide: MenuTemplateService,
      useValue: {
        search: () => NEVER,
        getById: () => NEVER
      }
    },
    {
      provide: BodyMeasurementService,
      useValue: {
        list: () => NEVER,
        getEvolution: () => NEVER
      }
    },
    {
      provide: TenantService,
      useValue: {
        getById: () => NEVER
      }
    },
    {
      provide: PatientEventService,
      useValue: {
        getByPatient: () => NEVER
      }
    },
    {
      provide: MealService,
      useValue: {
        getByMenuId: () => NEVER
      }
    },
    {
      provide: TenantBrandingService,
      useValue: {
        getBranding: () => NEVER
      }
    },
    {
      provide: ShoppingListService,
      useValue: {
        generateFromMenu: () => NEVER
      }
    }
  ]
})
export class SandboxComponent {}
