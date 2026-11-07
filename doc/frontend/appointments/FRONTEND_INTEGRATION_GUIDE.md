# Guía de Integración Frontend - Precios de Consultas

## 🎯 Objetivos

Esta guía proporciona ejemplos prácticos para integrar la nueva funcionalidad de precios en el frontend.

---

## 📦 Modelos TypeScript

### Modelo AppointmentType

```typescript
export interface AppointmentType {
  id: string;
  tenantId: string;
  name: string;
  durationMinutes: number;
  price: number;           // ← NUEVO
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}
```

### Modelo Appointment

```typescript
export interface Appointment {
  id: string;
  tenantId: string;
  nutritionistId: string;
  nutritionistName: string;
  patientId: string;
  patientName: string;
  typeId: string;
  typeName: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  notes: string;
  createdAt: Date;
  // price no se devuelve en el DTO pero está congelado en la BD
}
```

### Modelo TenantPreferences

```typescript
export interface TenantPreferences {
  enableVacationModule: boolean;
  enableClockInModule: boolean;
  defaultLanguage: string;
  primaryColor: string;
  keycloakSyncMode: string;
  fromEmail: string;
  standardVacationDays: number;
  activeAnamnesisFields: string[];
  aiEnabled: boolean;
  geminiApiKey: string;
  showPrice: boolean;        // ← NUEVO
}
```

---

## 🔌 Servicios Angular

### AppointmentTypeService

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppointmentType } from '../models/appointment-type.model';

@Injectable({ providedIn: 'root' })
export class AppointmentTypeService {
  private baseUrl = '/tenant';

  constructor(private http: HttpClient) {}

  /**
   * Crear nuevo tipo de consulta con precio
   */
  createAppointmentType(
    tenantId: string,
    request: {
      name: string;
      durationMinutes: number;
      price: number;
      isDefault: boolean;
    }
  ): Observable<AppointmentType> {
    return this.http.post<AppointmentType>(
      `${this.baseUrl}/${tenantId}/appointment-types`,
      request
    );
  }

  /**
   * Actualizar tipo de consulta (incluyendo precio)
   */
  updateAppointmentType(
    tenantId: string,
    typeId: string,
    request: {
      name?: string;
      durationMinutes?: number;
      price?: number;
      isDefault?: boolean;
      isActive?: boolean;
    }
  ): Observable<AppointmentType> {
    return this.http.put<AppointmentType>(
      `${this.baseUrl}/${tenantId}/appointment-types/${typeId}`,
      request
    );
  }

  /**
   * Obtener lista de tipos de consulta
   */
  listAppointmentTypes(
    tenantId: string,
    onlyActive: boolean = true
  ): Observable<AppointmentType[]> {
    return this.http.get<AppointmentType[]>(
      `${this.baseUrl}/${tenantId}/appointment-types?onlyActive=${onlyActive}`
    );
  }
}
```

### AppointmentService

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Appointment, AppointmentStatus } from '../models/appointment.model';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private baseUrl = '/tenant';

  constructor(private http: HttpClient) {}

  /**
   * Calcular total de ingresos en un rango de fechas
   * @param tenantId ID del tenant
   * @param startDate Fecha de inicio (ISO 8601)
   * @param endDate Fecha de fin (ISO 8601)
   * @returns Total en dinero
   */
  getTotalRevenue(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Observable<number> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    return this.http.get<number>(
      `${this.baseUrl}/${tenantId}/appointments/revenue?startDate=${start}&endDate=${end}`
    );
  }

  /**
   * Obtener ingresos del mes actual
   */
  getMonthlyRevenue(tenantId: string, date: Date = new Date()): Observable<number> {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    return this.getTotalRevenue(tenantId, startDate, endDate);
  }

  /**
   * Obtener ingresos de un año completo
   */
  getYearlyRevenue(tenantId: string, year: number): Observable<number> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    return this.getTotalRevenue(tenantId, startDate, endDate);
  }

  /**
   * Obtener ingresos para cada mes del año
   */
  getMonthlyRevenueByYear(tenantId: string, year: number): Observable<Map<number, number>> {
    const months = new Map<number, number>();
    const requests: Observable<number>[] = [];

    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      requests.push(this.getTotalRevenue(tenantId, startDate, endDate));
    }

    return new Observable(observer => {
      Promise.all(requests.map(req => req.toPromise()))
        .then(results => {
          for (let i = 0; i < results.length; i++) {
            months.set(i + 1, results[i] || 0);
          }
          observer.next(months);
          observer.complete();
        })
        .catch(err => observer.error(err));
    });
  }

  /**
   * Crear nueva cita (precio se copia automáticamente)
   */
  createAppointment(
    tenantId: string,
    request: {
      nutritionistId: string;
      patientId: string;
      startTime: Date;
      endTime?: Date;
      typeId?: string;
      notes?: string;
    }
  ): Observable<Appointment> {
    return this.http.post<Appointment>(
      `${this.baseUrl}/${tenantId}/appointments`,
      {
        ...request,
        startTime: request.startTime.toISOString(),
        endTime: request.endTime?.toISOString()
      }
    );
  }

  /**
   * Obtener citas por nutricionista
   */
  getAppointmentsByNutritionist(
    tenantId: string,
    nutritionistId: string,
    from?: Date,
    to?: Date,
    status?: AppointmentStatus
  ): Observable<Appointment[]> {
    let url = `${this.baseUrl}/${tenantId}/appointments/nutritionist/${nutritionistId}`;
    const params = new URLSearchParams();

    if (from) params.append('from', from.toISOString());
    if (to) params.append('to', to.toISOString());
    if (status) params.append('status', status);

    if (params.toString()) {
      url += '?' + params.toString();
    }

    return this.http.get<Appointment[]>(url);
  }
}
```

### TenantService

```typescript
import { Injectable } from '@angular/core';
import { TenantPreferences } from '../models/tenant-preferences.model';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private tenantPreferencesSubject = new BehaviorSubject<TenantPreferences | null>(null);

  getTenantPreferences(): Observable<TenantPreferences> {
    return this.tenantPreferencesSubject.asObservable();
  }

  /**
   * Verificar si se deben mostrar los precios
   */
  shouldShowPrice(): Observable<boolean> {
    return new Observable(observer => {
      this.tenantPreferencesSubject.subscribe(prefs => {
        observer.next(prefs?.showPrice ?? false);
      });
    });
  }
}
```

---

## 🎨 Componentes

### Formulario de Crear/Editar Tipo de Consulta

```typescript
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AppointmentTypeService } from '../services/appointment-type.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-appointment-type-form',
  templateUrl: './appointment-type-form.component.html',
  styleUrls: ['./appointment-type-form.component.css']
})
export class AppointmentTypeFormComponent implements OnInit {
  form: FormGroup;
  isEditMode = false;
  tenantId: string;
  typeId: string;

  constructor(
    private fb: FormBuilder,
    private appointmentTypeService: AppointmentTypeService,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      durationMinutes: [30, [Validators.required, Validators.min(1)]],
      price: [0, [Validators.required, Validators.min(0)]],  // ← NUEVO
      isDefault: [false]
    });
  }

  ngOnInit() {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';
    this.typeId = this.route.snapshot.paramMap.get('typeId') || '';

    if (this.typeId) {
      this.isEditMode = true;
      // Cargar datos existentes
    }
  }

  onSubmit() {
    if (this.form.invalid) return;

    const request = this.form.value;

    if (this.isEditMode) {
      this.appointmentTypeService
        .updateAppointmentType(this.tenantId, this.typeId, request)
        .subscribe(
          result => {
            console.log('Tipo de consulta actualizado:', result);
          },
          error => {
            console.error('Error:', error);
          }
        );
    } else {
      this.appointmentTypeService
        .createAppointmentType(this.tenantId, request)
        .subscribe(
          result => {
            console.log('Tipo de consulta creado:', result);
          },
          error => {
            console.error('Error:', error);
          }
        );
    }
  }
}
```

**Template HTML**:

```html
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <div>
    <label>Nombre</label>
    <input type="text" formControlName="name" placeholder="Ej: Primera Consulta">
  </div>

  <div>
    <label>Duración (minutos)</label>
    <input type="number" formControlName="durationMinutes" min="1" placeholder="30">
  </div>

  <!-- ← NUEVO CAMPO DE PRECIO -->
  <div>
    <label>Precio (€)</label>
    <input 
      type="number" 
      formControlName="price" 
      min="0" 
      step="0.01" 
      placeholder="50.00"
    >
  </div>

  <div>
    <input type="checkbox" formControlName="isDefault">
    <label>Hacer por defecto</label>
  </div>

  <button type="submit" [disabled]="form.invalid">
    {{ isEditMode ? 'Actualizar' : 'Crear' }}
  </button>
</form>
```

---

### Componente de Ingresos/Reporte

```typescript
import { Component, OnInit } from '@angular/core';
import { AppointmentService } from '../services/appointment.service';
import { ActivatedRoute } from '@angular/router';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-revenue-report',
  templateUrl: './revenue-report.component.html',
  styleUrls: ['./revenue-report.component.css']
})
export class RevenueReportComponent implements OnInit {
  tenantId: string;
  monthlyRevenue: Map<number, number> = new Map();
  totalYearlyRevenue = 0;
  selectedYear = new Date().getFullYear();
  chartData: ChartConfiguration<'bar'>;
  monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  constructor(
    private appointmentService: AppointmentService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';
    this.loadYearlyRevenue();
  }

  loadYearlyRevenue() {
    this.appointmentService
      .getMonthlyRevenueByYear(this.tenantId, this.selectedYear)
      .subscribe(
        monthlyData => {
          this.monthlyRevenue = monthlyData;
          this.totalYearlyRevenue = Array.from(monthlyData.values()).reduce((a, b) => a + b, 0);
          this.buildChart();
        },
        error => {
          console.error('Error loading revenue:', error);
        }
      );
  }

  buildChart() {
    const labels = this.monthNames;
    const data = Array.from({ length: 12 }, (_, i) => 
      this.monthlyRevenue.get(i + 1) || 0
    );

    this.chartData = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresos por Mes (€)',
            data,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: `Ingresos por Mes - ${this.selectedYear}`
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => '€' + value
            }
          }
        }
      }
    };
  }

  getMonthRevenue(month: number): string {
    const amount = this.monthlyRevenue.get(month) || 0;
    return this.formatCurrency(amount);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }

  previousYear() {
    this.selectedYear--;
    this.loadYearlyRevenue();
  }

  nextYear() {
    this.selectedYear++;
    this.loadYearlyRevenue();
  }
}
```

**Template HTML**:

```html
<div class="revenue-report">
  <h2>Reporte de Ingresos</h2>

  <div class="controls">
    <button (click)="previousYear()">← {{ selectedYear - 1 }}</button>
    <span>{{ selectedYear }}</span>
    <button (click)="nextYear()">{{ selectedYear + 1 }} →</button>
  </div>

  <div class="summary">
    <div class="card">
      <h3>Total Anual</h3>
      <p class="amount">{{ formatCurrency(totalYearlyRevenue) }}</p>
    </div>
  </div>

  <canvas *ngIf="chartData" [ngStyle]="{ position: 'relative', height: '400px' }">
    <app-chart [data]="chartData"></app-chart>
  </canvas>

  <table class="monthly-details">
    <thead>
      <tr>
        <th>Mes</th>
        <th>Ingresos</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let i of [1,2,3,4,5,6,7,8,9,10,11,12]">
        <td>{{ monthNames[i - 1] }}</td>
        <td>{{ getMonthRevenue(i) }}</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

### Componente de Listado de Tipos de Consulta (con precios)

```typescript
import { Component, OnInit } from '@angular/core';
import { AppointmentType } from '../models/appointment-type.model';
import { AppointmentTypeService } from '../services/appointment-type.service';
import { TenantService } from '../services/tenant.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-appointment-types-list',
  templateUrl: './appointment-types-list.component.html',
  styleUrls: ['./appointment-types-list.component.css']
})
export class AppointmentTypesListComponent implements OnInit {
  appointmentTypes: AppointmentType[] = [];
  tenantId: string;
  showPrice = false;  // Obtenido de TenantPreferences

  constructor(
    private appointmentTypeService: AppointmentTypeService,
    private tenantService: TenantService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';

    // Verificar si mostrar precios
    this.tenantService.shouldShowPrice().subscribe(
      show => (this.showPrice = show)
    );

    this.loadAppointmentTypes();
  }

  loadAppointmentTypes() {
    this.appointmentTypeService
      .listAppointmentTypes(this.tenantId, true)
      .subscribe(
        types => (this.appointmentTypes = types),
        error => console.error('Error loading types:', error)
      );
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  }

  deleteType(typeId: string) {
    // Implementar lógica de eliminación
    console.log('Eliminar tipo:', typeId);
  }
}
```

**Template HTML**:

```html
<div class="appointment-types">
  <h2>Tipos de Consulta</h2>

  <button routerLink="/appointment-types/create">+ Crear Nuevo</button>

  <table class="types-table">
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Duración</th>
        <!-- ← NUEVA COLUMNA DE PRECIO -->
        <th *ngIf="showPrice">Precio</th>
        <th>Predeterminado</th>
        <th>Activo</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let type of appointmentTypes">
        <td>{{ type.name }}</td>
        <td>{{ type.durationMinutes }} min</td>
        <td *ngIf="showPrice">{{ formatPrice(type.price) }}</td>
        <td>
          <span *ngIf="type.isDefault" class="badge badge-primary">Sí</span>
          <span *ngIf="!type.isDefault" class="badge badge-secondary">No</span>
        </td>
        <td>
          <span *ngIf="type.isActive" class="badge badge-success">Activo</span>
          <span *ngIf="!type.isActive" class="badge badge-danger">Inactivo</span>
        </td>
        <td>
          <button [routerLink]="['/appointment-types', type.id, 'edit']">
            Editar
          </button>
          <button (click)="deleteType(type.id)" class="danger">
            Eliminar
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 🔄 Estados y Transiciones

### Estados de Cita

```typescript
export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',      // Programada
  COMPLETED = 'COMPLETED',      // Completada (suma en ingresos)
  CANCELLED = 'CANCELLED',      // Cancelada
  NO_SHOW = 'NO_SHOW',          // No presentado
  PROPOSED = 'PROPOSED'         // Propuesta
}
```

**Importante**: Solo las citas con estado `COMPLETED` se incluyen en el cálculo de ingresos.

---

## 💾 Almacenamiento Local

Para guardar preferencias de usuario:

```typescript
export class LocalStorageService {
  /**
   * Guardar preferencia de mostrar precios
   */
  setShouldShowPrice(show: boolean): void {
    localStorage.setItem('show_price', JSON.stringify(show));
  }

  /**
   * Obtener preferencia de mostrar precios
   */
  getShouldShowPrice(): boolean {
    return JSON.parse(localStorage.getItem('show_price') ?? 'false');
  }
}
```

---

## 🧪 Tests Unitarios (Jasmine)

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AppointmentService } from './appointment.service';

describe('AppointmentService - Revenue', () => {
  let service: AppointmentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AppointmentService]
    });

    service = TestBed.inject(AppointmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should calculate revenue for date range', (done) => {
    const tenantId = 'test-tenant-123';
    const startDate = new Date('2024-02-01');
    const endDate = new Date('2024-02-29');
    const expectedRevenue = 150.00;

    service.getTotalRevenue(tenantId, startDate, endDate).subscribe(
      (revenue) => {
        expect(revenue).toBe(expectedRevenue);
        done();
      }
    );

    const req = httpMock.expectOne(req =>
      req.url.includes(`/tenant/${tenantId}/appointments/revenue`) &&
      req.url.includes('startDate=2024-02-01')
    );
    expect(req.request.method).toBe('GET');
    req.flush(expectedRevenue);
  });

  it('should return 0 for month with no completed appointments', (done) => {
    const tenantId = 'test-tenant-123';
    const startDate = new Date('2024-03-01');
    const endDate = new Date('2024-03-31');

    service.getTotalRevenue(tenantId, startDate, endDate).subscribe(
      (revenue) => {
        expect(revenue).toBe(0);
        done();
      }
    );

    const req = httpMock.expectOne(req =>
      req.url.includes(`/tenant/${tenantId}/appointments/revenue`)
    );
    req.flush(0);
  });

  it('should get monthly revenue for current month', (done) => {
    const tenantId = 'test-tenant-123';
    const expectedRevenue = 250.50;

    service.getMonthlyRevenue(tenantId).subscribe(
      (revenue) => {
        expect(revenue).toBe(expectedRevenue);
        done();
      }
    );

    const req = httpMock.expectOne(req =>
      req.url.includes(`/tenant/${tenantId}/appointments/revenue`)
    );
    req.flush(expectedRevenue);
  });
});
```

---

## 📊 Casos de Uso

### Caso 1: Mostrar Precios en Perfil de Tipo de Consulta

```typescript
ngOnInit() {
  this.tenantService.shouldShowPrice().subscribe(show => {
    if (show) {
      this.displayPriceField = true;
    }
  });
}
```

### Caso 2: Dashboard de Ingresos Mensuales

```typescript
loadDashboard() {
  this.appointmentService.getMonthlyRevenue(this.tenantId).subscribe(
    revenue => {
      this.currentMonthRevenue = revenue;
      this.updateDashboard();
    }
  );
}
```

### Caso 3: Exportar Reporte a CSV

```typescript
exportRevenueToCSV() {
  const data = Array.from(this.monthlyRevenue.entries()).map(([month, revenue]) => ({
    mes: this.monthNames[month - 1],
    ingresos: revenue
  }));

  // Usar librería como ngx-csv o Papa Parse
  const csv = Papa.unparse(data);
  // Descargar archivo
}
```

---

## 🔒 Validaciones Frontend

```typescript
// Validar que el precio sea un número decimal válido
priceValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  
  if (!value) return null;
  
  const decimalRegex = /^\d+(\.\d{1,2})?$/;
  
  if (!decimalRegex.test(value)) {
    return { invalidPrice: true };
  }
  
  return null;
}

// Usar en formulario
this.form = this.fb.group({
  price: ['', [Validators.required, this.priceValidator]]
});
```

---

## 📝 Notas Importantes

1. **Precio Inmutable**: Una vez creada una cita, su precio NO cambia aunque se modifique el precio del tipo de consulta.
2. **Solo COMPLETED**: Solo las citas con estado `COMPLETED` se incluyen en los cálculos de ingresos.
3. **Multitenancy**: Todos los datos están filtrados por `tenantId` automáticamente.
4. **Precisión Decimal**: Usar `BigDecimal` en backend y `number` en frontend (con validación).
5. **Zona Horaria**: Las fechas se usan en ISO 8601 (UTC). Adaptar al cliente según zona horaria.

