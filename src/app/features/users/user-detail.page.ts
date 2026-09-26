import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, debounceTime, forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';
import { ModalService, NotificationService, ConfirmService } from '../../core/ui';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/branding/theme.service';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { CalendarOptions, EventClickArg, DatesSetArg } from '@fullcalendar/core';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { PatientEventService } from '../../core/api/services/patient-event.api';
import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import { MenuService } from '../../core/api/services/menu.api';
import { AppointmentService } from '../../core/api/services/appointment.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TenantBrandingService } from '../../core/api/services/tenant-branding.api';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { AppUserDto, UserTenantProfileDto } from '../../core/api/models/user.model';
import { PatientEventDto } from '../../core/api/models/patient-event.model';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { BodyMeasurementDto, MeasurementHistoryDto, MeasurementPoint, BodyCompositionReport, SegmentalResult, BodySegment } from '../../core/api/models/body-measurement.model';
import { Menu } from '../../core/api/models/menu.model';
import { AppointmentDto } from '../../core/api/models/appointment.model';
import { Page } from '../../core/api/models/page.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { EmptyState } from '../../shared/ui/empty-state';
import { MeasurementFormDialog } from './measurement-form.dialog';
import { BoneMassDialog, BoneMassDialogInput } from './bone-mass.dialog';
import { EditUserDialog } from './edit-user.dialog';
import { QuickScheduleDialog, QuickScheduleDialogData } from '../appointments/quick-schedule.dialog';
import { WaterIntakeWidget } from '../tenant/dashboard/components/water-intake-widget';
import { PatientEventFormDialog } from './patient-event-form.dialog';
import { AssignMenuTemplateDialog } from './assign-menu-template.dialog';
import { AssignNutritionistDialog, AssignNutritionistDialogInput } from './assign-nutritionist.dialog';
import { MenuUploadDialog } from '../menus/menu-upload.dialog';
import { MenuFormDialog } from '../menus/menu-form.dialog';
import { formatInstant, formatInstantWithTime } from '../../shared/utils/date';
import { METRIC_SERIES, buildChartConfig, hexToRgba, themePrimary } from '../../shared/utils/chart-config';
import type { ChartConfiguration } from 'chart.js/auto';

import { Chart, registerables } from 'chart.js';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiButton, TuiCheckbox, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiPagination, TuiProgress, TuiSegmented, TuiSelect, TuiTabs, TuiTextarea } from '@taiga-ui/kit';
import { TuiTable } from '@taiga-ui/addon-table';

Chart.register(...registerables);

export type RangeStatus = 'below' | 'within' | 'above' | 'unknown';
export type CompositionCellId = 'fat_mass' | 'lean_mass' | 'water_mass' | 'bmi' | 'body_fat' | 'visceral_fat';
export type BadgeAppearance = 'positive' | 'warning' | 'info' | 'neutral' | 'negative';

/** Celda de la cuadrícula de composición (Guía §6 / diseño `ficha-paciente`). */
export interface CompositionCellItem {
  id: CompositionCellId;
  labelKey: string;
  value: number | null;
  unit: string;
  /** Clasificación localizada del backend (IMC / % grasa); sustituye al estado de rango. */
  classification: string | null;
  status: RangeStatus;
  badgeAppearance: BadgeAppearance;
  bandStartPct: number;
  bandEndPct: number;
  markerPct: number;
  markerClass: string;
  refKey: string;
  refParams: Record<string, string | number>;
}

/** Fila del listado segmental (barra proporcional + asimetría). */
export interface SegmentalRowItem {
  id: BodySegment;
  label: string;
  valueText: string;
  barPct: number;
  asymmetric: boolean;
  diffPct: number;
  markerClass: string;
}

/** Pieza del esquema corporal SVG. */
export interface SegmentalFigureItem {
  id: BodySegment;
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  labelX: number;
  labelY: number;
  /** Alineación del rótulo: a la izquierda/derecha de la extremidad, centrado en el tronco. */
  labelAnchor: 'start' | 'middle' | 'end';
  valueText: string;
  onTrunk: boolean;
  color: string;
  title: string;
}

/** Nota clínica bajo el análisis segmental. */
export interface SegmentalNoteItem {
  tone: 'ok' | 'err';
  key: string;
  params: Record<string, string | number>;
}

/** Pareja contralateral de cada segmento (para el cálculo de asimetría). */
const SEGMENT_PARTNER: Partial<Record<BodySegment, BodySegment>> = {
  RIGHT_ARM: 'LEFT_ARM',
  LEFT_ARM: 'RIGHT_ARM',
  RIGHT_LEG: 'LEFT_LEG',
  LEFT_LEG: 'RIGHT_LEG'
};

/** Geometría del esquema corporal (viewBox 0 0 140 230). El lado derecho del
 *  paciente se dibuja a la izquierda de la imagen, como en el diseño. */
const SEGMENT_GEOMETRY: Record<BodySegment, { x: number; y: number; width: number; height: number; rx: number }> = {
  TRUNK: { x: 52, y: 38, width: 36, height: 66, rx: 9 },
  RIGHT_ARM: { x: 34, y: 42, width: 14, height: 58, rx: 7 },
  LEFT_ARM: { x: 92, y: 42, width: 14, height: 58, rx: 7 },
  RIGHT_LEG: { x: 53, y: 108, width: 16, height: 84, rx: 8 },
  LEFT_LEG: { x: 71, y: 108, width: 16, height: 84, rx: 8 }
};

/** Rótulo de cada segmento. Los de brazos y piernas se colocan **fuera** de la
 *  extremidad (a su izquierda/derecha) para que no se solapen entre sí ni con los
 *  rótulos de lado, evitando el amontonamiento en piernas. */
const SEGMENT_LABEL: Record<BodySegment, { x: number; y: number; anchor: 'start' | 'middle' | 'end' }> = {
  TRUNK: { x: 70, y: 74, anchor: 'middle' },
  RIGHT_ARM: { x: 31, y: 73, anchor: 'end' },
  LEFT_ARM: { x: 109, y: 73, anchor: 'start' },
  RIGHT_LEG: { x: 50, y: 152, anchor: 'end' },
  LEFT_LEG: { x: 90, y: 152, anchor: 'start' }
};

/** Cifra del resumen del perfil (tira de figuras de la Guía). */
export interface ProfileFigure {
  id: string;
  labelKey: string;
  valueText: string;
  unit: string;
  deltaText: string | null;
  toneClass: string;
}

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IfPermissionDirective,
    TranslocoDirective,
    EmptyState,
    FullCalendarModule,
    WaterIntakeWidget,
    SkeletonComponent,
    TuiButton,
    TuiBadge,
    TuiProgress,
    TuiTable,
    TuiTabs,
    TuiTextfield,
    TuiTextarea,
    TuiCheckbox,
    TuiPagination,
    TuiSegmented,
    TuiSelect
  ],
  templateUrl: './user-detail.page.html'
})
export default class UserDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly measurementService = inject(BodyMeasurementService);
  private readonly menuService = inject(MenuService);
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantBrandingService = inject(TenantBrandingService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly patientEventService = inject(PatientEventService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly modal = inject(ModalService);
  private readonly transloco = inject(TranslocoService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly themeService = inject(ThemeService);

  constructor() {
    // Subscribe to theme changes and rebuild chart when theme toggles
    effect(() => {
      this.themeService.colorScheme(); // Reactive dependency
      if (this.measurementHistory() && this.chartLoaded()) {
        // Rebuild chart on next tick to allow CSS variables to update
        requestAnimationFrame(() => {
          const history = this.measurementHistory();
          if (history) {
            this.buildChart(history);
          }
        });
      }
    });
  }

  aiEnabled = signal(false);

  // Metadata describing the structured medical checklist and lifestyle/nutrition fields rendered in the profile tab.
  readonly checklistFields = [
    { id: 'hasDiabetes', notesId: 'diabetesNotes', icon: 'fa-solid fa-droplet' },
    { id: 'hasHypertension', notesId: 'hypertensionNotes', icon: 'fa-solid fa-heart-pulse' },
    { id: 'hasHeartDisease', notesId: 'heartDiseaseNotes', icon: 'fa-solid fa-heart' },
    { id: 'hasCholesterol', notesId: 'cholesterolNotes', icon: 'fa-solid fa-droplet' },
    { id: 'hasAllergiesAsthma', notesId: 'allergiesAsthmaNotes', icon: 'fa-solid fa-allergies' },
    { id: 'hasLiverDisease', notesId: 'liverDiseaseNotes', icon: 'fa-solid fa-filter' },
    { id: 'hasGallbladderDisease', notesId: 'gallbladderDiseaseNotes', icon: 'fa-solid fa-vial' },
    { id: 'hasKidneyDisease', notesId: 'kidneyDiseaseNotes', icon: 'fa-solid fa-water' },
    { id: 'hasStomachDisease', notesId: 'stomachDiseaseNotes', icon: 'fa-solid fa-bowl-food' },
    { id: 'hasUricAcidGout', notesId: 'uricAcidGoutNotes', icon: 'fa-solid fa-shoe-prints' },
    { id: 'hasCirculationIssues', notesId: 'circulationIssuesNotes', icon: 'fa-solid fa-wave-square' },
    { id: 'hasThyroidIssues', notesId: 'thyroidIssuesNotes', icon: 'fa-solid fa-ankh' },
    { id: 'hasAnemia', notesId: 'anemiaNotes', icon: 'fa-solid fa-disease' },
    { id: 'hasConstipation', notesId: 'constipationNotes', icon: 'fa-solid fa-toilet' },
    { id: 'hasMusculoskeletalIssues', notesId: 'musculoskeletalIssuesNotes', icon: 'fa-solid fa-bone' },
    { id: 'hasSurgeries', notesId: 'surgeriesNotes', icon: 'fa-solid fa-scissors' },
    { id: 'hasMenstrualCycleIssues', notesId: 'menstrualCycleIssuesNotes', icon: 'fa-solid fa-venus' },
    { id: 'hasSleepIssues', notesId: 'sleepIssuesNotes', icon: 'fa-solid fa-moon' }
  ];

  readonly lifestyleTextFields = [
    { id: 'habits', icon: 'fa-solid fa-mug-hot' },
    { id: 'lifestyle', icon: 'fa-solid fa-bed' },
    { id: 'exercise', icon: 'fa-solid fa-dumbbell' },
    { id: 'psyche', icon: 'fa-solid fa-face-smile' },
    { id: 'foodPreferences', icon: 'fa-solid fa-utensils' }
  ];

  user = signal<AppUserDto | null>(null);
  measurements = signal<BodyMeasurementDto[]>([]);
  measurementHistory = signal<MeasurementHistoryDto | null>(null);
  menus = signal<Menu[]>([]);
  activeMenu = signal<Menu | null>(null);
  appointments = signal<AppointmentDto[]>([]);
  loadingUser = signal(true);
  loadingMeasurements = signal(true);
  loadingMenus = signal(true);
  loadingAppointments = signal(true);
  totalRecords = signal(0);
  userId = '';

  // Patients only: team members have their own file at `/staff/:id`.
  readonly backRoute = '/patients';

  canViewPatientProfile = computed(() => this.permissionsService.has('VIEW_PATIENT_PROFILE'));
  canManagePatientProfile = computed(() => this.permissionsService.has('MANAGE_PATIENT_PROFILE'));
  canViewAppointments = computed(() => this.permissionsService.has('VIEW_APPOINTMENTS'));
  canManageMenu = computed(() => this.permissionsService.has('MANAGE_MENU'));
  canViewPatientEvents = computed(() => this.permissionsService.has('VIEW_PATIENT_EVENTS'));
  canManagePatientEvents = computed(() => this.permissionsService.has('MANAGE_PATIENT_EVENTS'));
  canManageUsers = computed(() => this.permissionsService.has('MANAGE_USER'));

  /**
   * Titular nutritionist of the patient (V45). Resolved separately because
   * `GET /users/{userId}` returns AppUser_Full, which does not carry the
   * assigned-nutritionist fields (those live on TenantUserDto).
   */
  assignedNutritionist = signal<{ id: string | null; name: string | null }>({ id: null, name: null });

  canActivateMenus = computed(() =>
    this.canManageMenu() ||
    (this.user()?.userType === 'PATIENT' && this.authService.user()?.id === this.userId)
  );

  canDownloadCompositionPdf = computed(() =>
    this.permissionsService.has('VIEW_USER') ||
    (this.user()?.userType === 'PATIENT' && this.authService.user()?.id === this.userId)
  );

  /**
   * Los dos últimos puntos de la evolución (más reciente primero). `points`
   * viene del backend ordenado de más nuevo a más viejo, pero se reordena por
   * si acaso; si aún no hay histórico se usa la primera página de mediciones.
   */
  private readonly lastTwoPoints = computed<MeasurementPoint[]>(() => {
    const history = this.measurementHistory()?.points ?? [];
    const source: MeasurementPoint[] = [...(history.length ? history : this.measurements())];
    source.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
    return source.slice(0, 2);
  });

  /** Tira de cifras del Perfil: valor actual + variación desde la visita anterior. */
  readonly profileFigures = computed<ProfileFigure[]>(() => {
    const [last, prev] = this.lastTwoPoints();
    if (!last) return [];

    const defs: {
      id: string;
      labelKey: string;
      value: number | null | undefined;
      previous: number | null | undefined;
      unit: string;
      /** En el resumen, subir es positivo (agua y masa muscular). */
      higherIsBetter?: boolean;
    }[] = [
      { id: 'weight', labelKey: 'users.fig_weight', value: last.weightKg, previous: prev?.weightKg, unit: 'kg' },
      { id: 'bmi', labelKey: 'users.fig_bmi', value: last.bmi, previous: prev?.bmi, unit: '' },
      { id: 'fat', labelKey: 'users.fig_fat', value: last.bodyFatPct, previous: prev?.bodyFatPct, unit: '' },
      { id: 'water', labelKey: 'users.fig_water', value: last.bodyWaterPct, previous: prev?.bodyWaterPct, unit: '', higherIsBetter: true },
      { id: 'muscle', labelKey: 'users.fig_muscle', value: last.muscleMassPct, previous: prev?.muscleMassPct, unit: '', higherIsBetter: true },
    ];

    return defs
      .filter(d => d.value !== null && d.value !== undefined)
      .map(d => {
        const value = d.value as number;
        const delta = d.previous !== null && d.previous !== undefined ? value - (d.previous as number) : null;
        const sign = delta === null || delta === 0 ? '' : delta > 0 ? '+' : '−';
        const isFlat = delta === null || Math.abs(delta) < 0.05;
        const improving = delta !== null && (d.higherIsBetter ? delta > 0 : delta < 0);
        return {
          id: d.id,
          labelKey: d.labelKey,
          valueText: value.toFixed(1),
          unit: d.unit,
          deltaText: isFlat
            ? null
            : `${sign}${Math.abs(delta as number).toFixed(1)}${d.unit ? ' ' + d.unit : ''}`,
          toneClass: isFlat ? 'text-surface-400' : improving ? 'text-ok' : 'text-err',
        };
      });
  });

  readonly measurementsCount = computed(() => {
    const history = this.measurementHistory()?.points?.length;
    return history && history > 0 ? history : this.totalRecords();
  });

  readonly latestMeasurementDate = computed<string | null>(() => {
    const point = this.lastTwoPoints()[0];
    return point?.measuredAt ?? this.user()?.lastMeasurement?.measuredAt ?? null;
  });

  readonly wristCircumference = computed<number | null>(() =>
    this.user()?.lastMeasurement?.wristCircumferenceCm
      ?? this.activeCompositionReport()?.patient?.wristCircumferenceCm
      ?? null
  );

  readonly symmetryAlert = computed(() => this.activeCompositionReport()?.symmetry?.hasAnyAsymmetryAlert === true);

  readonly nextAppointment = computed<AppointmentDto | null>(() => {
    const now = Date.now();
    return this.appointments()
      .filter(a => (a.status === 'SCHEDULED' || a.status === 'PROPOSED') && new Date(a.startTime).getTime() >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null;
  });

  patientProfile = signal<UserTenantProfileDto | null>(null);
  loadingProfile = signal(false);
  calculatingComposition = signal(false);
  downloadingCompositionPdf = signal(false);
  isSendingResetPassword = signal(false);

  activeCompositionReport = computed<BodyCompositionReport | null>(() => {
    return this.patientProfile()?.bodyCompositionReport
      || this.user()?.lastMeasurement?.bodyCompositionReport
      || this.measurements()[0]?.bodyCompositionReport
      || null;
  });

  currentBodyFatPct = computed<number | null>(() => {
    const direct = this.user()?.lastMeasurement?.bodyFatPct ?? null;
    if (direct != null) return direct;
    const report = this.activeCompositionReport();
    if (report?.global?.fatMassKg != null && (report.patient?.weightKg ?? 0) > 0) {
      return Math.round((report.global.fatMassKg / report.patient.weightKg) * 1000) / 10;
    }
    return null;
  });

  /** Modo del análisis segmental: masa magra (por defecto) o masa grasa. */
  readonly segmentalMode = signal<'lean' | 'fat'>('lean');

  setSegmentalMode(mode: 'lean' | 'fat') {
    this.segmentalMode.set(mode);
  }

  private readonly segmentalMap = computed(() => {
    const report = this.activeCompositionReport();
    const out = new Map<BodySegment, SegmentalResult>();
    if (report?.segmentalAnalysis) {
      Object.values(report.segmentalAnalysis).forEach(seg => out.set(seg.segment, seg));
    }
    return out;
  });

  private readonly asymmetryThreshold = computed(() =>
    this.activeCompositionReport()?.symmetry?.thresholdPct ?? 5
  );

  private segmentValue(seg: SegmentalResult): number {
    return this.segmentalMode() === 'lean' ? seg.leanMassKg : seg.fatMassKg;
  }

  /** Diferencia porcentual frente al segmento contralateral (o null si no tiene pareja). */
  private segmentPairDiff(seg: SegmentalResult): number | null {
    const partnerId = SEGMENT_PARTNER[seg.segment];
    if (!partnerId) return null;
    const partner = this.segmentalMap().get(partnerId);
    if (!partner) return null;
    const a = this.segmentValue(seg);
    const b = this.segmentValue(partner);
    const max = Math.max(a, b);
    return max > 0 ? Math.abs(a - b) / max * 100 : 0;
  }

  /** Suma de la masa (magra o grasa, según el modo) de todos los segmentos. */
  private readonly segmentalTotal = computed(() =>
    [...this.segmentalMap().values()].reduce((acc, seg) => acc + this.segmentValue(seg), 0)
  );

  /** Reparto del segmento sobre el total del modo activo, en porcentaje. */
  private segmentPct(seg: SegmentalResult): number {
    const total = this.segmentalTotal();
    return total > 0 ? this.segmentValue(seg) / total * 100 : 0;
  }

  /** Cuadrícula de composición: 6 métricas con su banda de referencia y marcador. */
  compositionCells = computed<CompositionCellItem[]>(() => {
    const report = this.activeCompositionReport();
    if (!report?.global) return [];

    const ranges = report.referenceRanges;
    const weight = report.patient?.weightKg ?? 0;
    const fatPct = this.currentBodyFatPct();

    const fatBandLo = ranges ? ranges.fatMassPctMin / 100 * weight : weight * 0.21;
    const fatBandHi = ranges ? ranges.fatMassPctMax / 100 * weight : weight * 0.33;
    const fatPctLo = ranges?.fatMassPctMin ?? 21;
    const fatPctHi = ranges?.fatMassPctMax ?? 33;
    const leanLo = ranges?.fatFreeMassMinKg ?? weight * 0.67;
    const leanHi = ranges?.fatFreeMassMaxKg ?? weight * 0.79;
    const waterLo = ranges?.waterMassMinKg ?? weight * 0.45;
    const waterHi = ranges?.waterMassMaxKg ?? weight * 0.60;

    const defs: {
      id: CompositionCellId;
      labelKey: string;
      value: number | null;
      unit: string;
      bandLo: number;
      bandHi: number;
      classification: string | null;
      badgeAppearance: BadgeAppearance;
      refKey: string;
      refParams: Record<string, string | number>;
    }[] = [
      {
        id: 'fat_mass',
        labelKey: 'measurements.fat_mass',
        value: report.global.fatMassKg ?? null,
        unit: 'kg',
        bandLo: fatBandLo,
        bandHi: fatBandHi,
        classification: null,
        badgeAppearance: 'neutral',
        refKey: 'measurements.ref_fat_mass',
        refParams: { min: fatBandLo.toFixed(1), max: fatBandHi.toFixed(1), pmin: fatPctLo, pmax: fatPctHi }
      },
      {
        id: 'lean_mass',
        labelKey: 'measurements.lean_mass',
        value: report.global.fatFreeMassKg ?? null,
        unit: 'kg',
        bandLo: leanLo,
        bandHi: leanHi,
        classification: null,
        badgeAppearance: 'neutral',
        refKey: 'measurements.ref_lean_mass',
        refParams: { min: leanLo.toFixed(1), max: leanHi.toFixed(1) }
      },
      {
        id: 'water_mass',
        labelKey: 'measurements.water_mass',
        value: report.global.waterMassKg ?? null,
        unit: 'L',
        bandLo: waterLo,
        bandHi: waterHi,
        classification: null,
        badgeAppearance: 'neutral',
        refKey: 'measurements.ref_water',
        refParams: { min: waterLo.toFixed(1), max: waterHi.toFixed(1) }
      },
      {
        id: 'bmi',
        labelKey: 'measurements.bmi',
        value: report.global.bmi ?? null,
        unit: '',
        bandLo: 18.5,
        bandHi: 24.9,
        classification: report.global.localizedBmiClassification ?? null,
        badgeAppearance: this.getBmiBadgeAppearance(report.global.bmiClassification),
        refKey: 'measurements.ref_bmi',
        refParams: {}
      },
      {
        id: 'body_fat',
        labelKey: 'measurements.body_fat',
        value: fatPct,
        unit: '%',
        bandLo: fatPctLo,
        bandHi: fatPctHi,
        classification: report.global.localizedBodyFatClassification ?? null,
        badgeAppearance: this.getBodyFatBadgeAppearance(report.global.bodyFatClassification),
        refKey: 'measurements.ref_body_fat',
        refParams: { min: fatPctLo, max: fatPctHi }
      },
      {
        id: 'visceral_fat',
        labelKey: 'measurements.visceral_fat',
        value: report.global.visceralFatLevel ?? null,
        unit: '',
        bandLo: 1,
        bandHi: 9,
        classification: null,
        badgeAppearance: 'neutral',
        refKey: 'measurements.ref_visceral',
        refParams: {}
      }
    ];

    return defs.map(def => {
      const status = this.getRangeStatus(def.value, def.bandLo, def.bandHi);
      const span = Math.max(def.bandHi - def.bandLo, 0.0001);
      const scaleLo = def.bandLo - span;
      const scaleHi = def.bandHi + span;
      const toPct = (v: number) => Math.max(0, Math.min(100, (v - scaleLo) / (scaleHi - scaleLo) * 100));
      const markerClass = status === 'within'
        ? 'bg-ok'
        : status === 'below'
          ? 'bg-warn'
          : status === 'above'
            ? 'bg-err'
            : 'bg-surface-400';
      return {
        id: def.id,
        labelKey: def.labelKey,
        value: def.value,
        unit: def.unit,
        classification: def.classification,
        status,
        badgeAppearance: def.classification ? def.badgeAppearance : this.getRangeBadgeAppearance(status),
        bandStartPct: toPct(def.bandLo),
        bandEndPct: toPct(def.bandHi),
        markerPct: def.value != null ? toPct(def.value) : 50,
        markerClass,
        refKey: def.refKey,
        refParams: def.refParams
      };
    });
  });

  /** Filas del listado segmental (barra proporcional + reparto en % + asimetría). */
  segmentalRows = computed<SegmentalRowItem[]>(() => {
    const segs = [...this.segmentalMap().values()];
    if (segs.length === 0) return [];
    const maxValue = Math.max(...segs.map(s => this.segmentValue(s)), 0) || 1;
    const threshold = this.asymmetryThreshold();
    return segs.map(seg => {
      const diff = this.segmentPairDiff(seg);
      const asymmetric = diff !== null && diff > threshold;
      const value = this.segmentValue(seg);
      return {
        id: seg.segment,
        label: seg.localizedSegmentName,
        valueText: `${this.segmentPct(seg).toFixed(1)} %`,
        barPct: Math.max(4, Math.min(100, value / maxValue * 100)),
        asymmetric,
        diffPct: Math.round((diff ?? 0) * 10) / 10,
        markerClass: asymmetric ? 'bg-err' : 'bg-ok'
      };
    });
  });

  /** Piezas del esquema corporal SVG. */
  segmentalFigure = computed<SegmentalFigureItem[]>(() => {
    const threshold = this.asymmetryThreshold();
    return [...this.segmentalMap().values()].map(seg => {
      const diff = this.segmentPairDiff(seg);
      const asymmetric = diff !== null && diff > threshold;
      const geo = SEGMENT_GEOMETRY[seg.segment];
      const lbl = SEGMENT_LABEL[seg.segment];
      const pct = this.segmentPct(seg);
      return {
        id: seg.segment,
        x: geo.x,
        y: geo.y,
        width: geo.width,
        height: geo.height,
        rx: geo.rx,
        labelX: lbl.x,
        labelY: lbl.y,
        labelAnchor: lbl.anchor,
        valueText: `${pct.toFixed(1)}%`,
        onTrunk: seg.segment === 'TRUNK',
        color: asymmetric ? 'var(--err)' : 'var(--ok)',
        title: `${seg.localizedSegmentName}: ${pct.toFixed(1)} % · ${this.segmentValue(seg).toFixed(2)} kg`
      };
    });
  });

  /** Notas clínicas de simetría bajo el listado segmental. */
  segmentalNotes = computed<SegmentalNoteItem[]>(() => {
    const map = this.segmentalMap();
    const threshold = this.asymmetryThreshold();
    const pairs: { part: 'arms' | 'legs'; ids: [BodySegment, BodySegment] }[] = [
      { part: 'arms', ids: ['LEFT_ARM', 'RIGHT_ARM'] },
      { part: 'legs', ids: ['LEFT_LEG', 'RIGHT_LEG'] }
    ];
    const notes: SegmentalNoteItem[] = [];
    pairs.forEach(({ part, ids }) => {
      const a = map.get(ids[0]);
      const b = map.get(ids[1]);
      if (!a || !b) return;
      const va = this.segmentValue(a);
      const vb = this.segmentValue(b);
      const max = Math.max(va, vb);
      const diff = max > 0 ? Math.abs(va - vb) / max * 100 : 0;
      const asymmetric = diff > threshold;
      notes.push({
        tone: asymmetric ? 'err' : 'ok',
        key: `measurements.seg_${asymmetric ? 'asymmetry' : 'symmetry'}_${part}`,
        params: { pct: Math.round(diff * 10) / 10, threshold }
      });
    });
    return notes;
  });

  editingGuidelines = signal(false);
  savingGuidelines = signal(false);
  editBreakfast = signal('');
  editLunch = signal('');
  editSnack = signal('');
  editObservations = signal('');

  saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  private readonly saveSubject = new Subject<void>();
  private saveSub?: Subscription;
  private lastSavedPayload = '';
  private savedStatusTimeout?: ReturnType<typeof setTimeout>;

  editProfileData = signal<Partial<UserTenantProfileDto>>({});

  /** Nº de antecedentes marcados como activos (contador de la tarjeta). */
  readonly activeChecklistCount = computed(() =>
    this.checklistFields.filter(field => this.getChecklistValue(field.id)).length
  );

  getChecklistValue(field: string): boolean {
    const data = this.editProfileData() as Record<string, unknown>;
    return Boolean(data[field]);
  }

  onCheckboxToggle(field: string, value: boolean) {
    this.editProfileData.update(d => ({ ...d, [field]: value }));
    this.persistProfile();
  }

  getChecklistNotes(field: string): string {
    const data = this.editProfileData() as Record<string, unknown>;
    const value = data[field];
    return typeof value === 'string' ? value : '';
  }

  onNotesChange(field: string, value: string) {
    this.editProfileData.update(d => ({ ...d, [field]: value || null }));
    this.saveStatus.set('saving');
    this.saveSubject.next();
  }

  onNotesBlur() {
    this.persistProfile();
  }

  persistProfile() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.canManagePatientProfile()) return;

    const data = this.editProfileData();
    const current = this.patientProfile() || {};
    const request: UserTenantProfileDto = {
      ...current,
      ...data
    } as UserTenantProfileDto;

    const serialized = JSON.stringify(request);
    if (serialized === this.lastSavedPayload) {
      if (this.saveStatus() === 'saving') {
        this.saveStatus.set('idle');
      }
      return;
    }

    this.saveStatus.set('saving');
    this.userTenantRoleService.updatePatientProfile(tenantId, this.userId, request).subscribe({
      next: (updatedProfile) => {
        this.lastSavedPayload = serialized;
        this.patientProfile.set(updatedProfile || request);
        this.saveStatus.set('saved');

        if (this.savedStatusTimeout) {
          clearTimeout(this.savedStatusTimeout);
        }
        this.savedStatusTimeout = setTimeout(() => {
          if (this.saveStatus() === 'saved') {
            this.saveStatus.set('idle');
          }
        }, 3000);
      },
      error: () => {
        this.saveStatus.set('error');
        this.notify.error(
          this.transloco.translate('patient_profile.save_error'),
          this.transloco.translate('common.error')
        );
      }
    });
  }

  camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  patientEvents = signal<PatientEventDto[]>([]);
  loadingEvents = signal(false);

  private readonly baseCalendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth'
    },
    locales: [esLocale],
    locale: 'es',
    height: 'auto',
    firstDay: 1,
    editable: false,
    selectable: false,
  };

  calendarOptions = computed<CalendarOptions>(() => ({
    ...this.baseCalendarOptions,
    eventClick: (info: EventClickArg) => this.handlePatientEventClick(info),
    datesSet: (info: DatesSetArg) => this.onPatientEventDatesSet(info),
    events: this.patientEvents().map(e => ({
      id: e.id,
      title: e.title,
      start: e.startTime,
      allDay: true,
      backgroundColor: hexToRgba(themePrimary(), 0.12),
      borderColor: themePrimary(),
      textColor: '#334155',
      extendedProps: {
        description: e.description,
        startTime: e.startTime
      }
    })),
  }));

  activeTabIndex = signal(0);

  protected readonly tabs = computed(() => {
    const items: { id: string; label: string; defaultValue?: string; icon: string }[] = [];

    items.push({ id: 'profile', label: 'users.tab_profile', icon: 'fa-solid fa-user' });
    items.push({ id: 'measurements', label: 'users.tab_measurements', icon: 'fa-solid fa-chart-line' });
    items.push({ id: 'body_composition', label: 'users.tab_body_composition', defaultValue: 'Composición Corporal', icon: 'fa-solid fa-child' });
    items.push({ id: 'menus', label: 'users.tab_menus', icon: 'fa-solid fa-utensils' });
    items.push({ id: 'water', label: 'users.tab_water', defaultValue: 'Agua', icon: 'fa-solid fa-droplet' });

    if (this.canViewPatientProfile()) {
      items.push({ id: 'patient_profile', label: 'users.tab_patient_profile', icon: 'fa-solid fa-notes-medical' });
      items.push({ id: 'fixed_guidelines', label: 'users.tab_fixed_guidelines', icon: 'fa-solid fa-apple-whole' });
    }

    if (this.canViewPatientEvents()) {
      items.push({ id: 'patient_events', label: 'users.tab_patient_events', icon: 'fa-solid fa-calendar-days' });
    }

    if (this.canViewAppointments()) {
      items.push({ id: 'appointments', label: 'appointments.history_title', icon: 'fa-solid fa-clock-rotate-left' });
    }

    return items;
  });

  activeTabId = computed(() => this.tabs()[this.activeTabIndex()]?.id ?? 'profile');

  // Chart
  chartData: ChartConfiguration<'line'>['data'] | null = null;
  chartOptions: ChartConfiguration<'line'>['options'] | null = null;
  chartLoaded = signal(false);
  chartType = signal<'composition' | 'anthropometry'>('composition');
  readonly chartTypeOptions = [
    { label: 'Composición Corporal', value: 'composition' as const },
    { label: 'Antropometría', value: 'anthropometry' as const },
  ];
  private readonly COMPOSITION_FIELDS = new Set<string>(['weightKg', 'bmi', 'bodyFatPct', 'muscleMassPct', 'bodyWaterPct']);
  private readonly ANTHROPOMETRY_FIELDS = new Set<string>(['waistCm', 'chestCm', 'hipsCm', 'contourCm', 'armCm']);

  private _chartCanvasEl?: ElementRef<HTMLCanvasElement>;

  @ViewChild('chartCanvas') set chartCanvasEl(el: ElementRef<HTMLCanvasElement> | undefined) {
    this._chartCanvasEl = el;
    if (el) this.renderChartIfReady();
  }

  private chartInstance: Chart | null = null;

  // Table pagination
  page = signal(0);
  size = signal(25);

  protected readonly formatInstant = formatInstant;
  protected readonly formatInstantWithTime = formatInstantWithTime;

  getInitials(user: AppUserDto): string {
    const first = (user.firstName ?? '').trim();
    const last = (user.lastName ?? '').trim();
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    return initials || '?';
  }

  getRoleLabel(user: AppUserDto): string {
    if (user.roleName) return user.roleName;
    const tenantId = this.tenantCtx.currentTenantId();
    const membership = user.memberships?.find(m => m.tenantId === tenantId);
    return membership?.roleCode || 'DESCONOCIDO';
  }

  ngOnInit() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (tenantId) {
      this.tenantBrandingService.getBranding(tenantId).subscribe({
        next: (branding) => this.aiEnabled.set(branding.aiEnabled === true),
        error: () => this.aiEnabled.set(false)
      });
    }

    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (this.userId) {
      this.loadUser();
    }

    this.saveSub = this.saveSubject.pipe(debounceTime(1000)).subscribe(() => {
      this.persistProfile();
    });
  }

  private onUserLoaded() {
    this.loadMeasurements(0, this.size());
    this.loadEvolution();
    this.loadMenuHistory();
    this.loadAppointments();
    if (this.canViewPatientProfile()) {
      this.loadPatientProfile();
    }
    if (this.canViewPatientEvents()) {
      this.loadPatientEvents();
    }
  }

  private loadUser() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingUser.set(true);
    this.userTenantRoleService.getUser(tenantId, this.userId).subscribe({
      next: (u) => {
        // Team members are no longer rendered here: send old links to the
        // dedicated staff file (activity, portfolio, admin actions).
        if (u.userType === 'STAFF') {
          this.loadingUser.set(false);
          this.router.navigate(['/staff', u.id], { replaceUrl: true });
          return;
        }

        this.user.set(u);
        this.loadingUser.set(false);
        this.onUserLoaded();
        this.loadAssignedNutritionist(u);
      },
      error: () => this.loadingUser.set(false)
    });
  }

  private loadAssignedNutritionist(user: AppUserDto) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !user.email) return;

    this.userTenantRoleService.getUsersByTenant(tenantId, { search: user.email, size: 5 }).subscribe({
      next: (res) => {
        const match = (res.content || []).find(u => u.id === user.id);
        this.assignedNutritionist.set({
          id: match?.assignedNutritionistId ?? null,
          name: match?.assignedNutritionistName ?? null
        });
      }
    });
  }

  loadMeasurements(page: number, size: number) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingMeasurements.set(true);
    this.page.set(page);
    this.size.set(size);
    this.measurementService.list(tenantId, this.userId, page, size).subscribe({
      next: (res: Page<BodyMeasurementDto>) => {
        this.measurements.set(res.content || []);
        this.totalRecords.set(res.page?.totalElements || 0);
        this.loadingMeasurements.set(false);
      },
      error: () => this.loadingMeasurements.set(false)
    });
  }

  onPageChange(page: number) {
    this.page.set(page);
    this.loadMeasurements(page, this.size());
  }

  onSizeChange(size: number) {
    this.size.set(size);
    this.page.set(0);
    this.loadMeasurements(0, size);
  }

  /** Número total de páginas de la tabla de mediciones (tui-pagination). */
  readonly totalPages = computed(() => Math.ceil(this.totalRecords() / this.size()) || 1);


  private loadEvolution() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.measurementService.getEvolution(tenantId, this.userId).subscribe({
      next: (history) => {
        this.measurementHistory.set(history);
        this.buildChart(history);
      }
    });
  }

  private buildChart(history: MeasurementHistoryDto) {
    const points = history.points;
    if (!points || points.length === 0) {
      this.chartLoaded.set(false);
      return;
    }

    const sorted = [...points].reverse();
    const labels = sorted.map(p => {
      const d = new Date(p.measuredAt);
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    });

    const selectedFields = this.chartType() === 'composition' ? this.COMPOSITION_FIELDS : this.ANTHROPOMETRY_FIELDS;
    const pctFields = new Set<string>(['bmi', 'bodyFatPct', 'bodyWaterPct', 'muscleMassPct']);
    const kgFields = new Set<string>(['weightKg']);
    const cmFields = new Set<string>(['waistCm', 'chestCm', 'hipsCm', 'contourCm', 'armCm']);

    const unitFor = (field: string): string => {
      if (kgFields.has(field)) return ' kg';
      if (pctFields.has(field)) return field === 'bmi' ? '' : ' %';
      if (cmFields.has(field)) return ' cm';
      return '';
    };

    const transloco = this.transloco;
    const datasets = METRIC_SERIES
      .filter(series => selectedFields.has(series.field))
      .filter(series => sorted.some(p => p[series.field] != null))
      .map(series => ({
        label: transloco.translate(series.label),
        data: sorted.map(p => p[series.field]),
        borderColor: series.color,
        backgroundColor: series.color, // Will be transformed to gradient in buildChartConfig
        yAxisID: this.chartType() === 'composition' && pctFields.has(series.field) ? 'y1' as const : 'y' as const,
        fill: !(this.chartType() === 'composition' && pctFields.has(series.field)),
        unit: unitFor(series.field),
      }));

    const axisTitles = this.chartType() === 'composition'
      ? { y: 'kg', y1: '% / IMC' }
      : { y: 'cm' };

    const config = buildChartConfig(labels, datasets, axisTitles);
    this.chartData = config.data;
    this.chartOptions = config.options;
    this.chartLoaded.set(true);
    this.renderChartIfReady();
  }

  
  private renderChartIfReady() {
    if (!this.chartData || !this._chartCanvasEl) return;
    if (this.chartInstance) this.chartInstance.destroy();
    this.chartInstance = new Chart(this._chartCanvasEl.nativeElement, {
      type: 'line',
      data: this.chartData,
      options: this.chartOptions ?? undefined,
    });
  }

  setChartType(type: 'composition' | 'anthropometry') {
    this.chartType.set(type);
    const history = this.measurementHistory();
    if (history) {
      this.buildChart(history);
    }
  }

  private loadMenuHistory() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingMenus.set(true);
    this.menuService.history(tenantId, this.userId).subscribe({
      next: (menuList) => {
        this.menus.set(menuList || []);
        const active = (menuList || []).find(m => m.isActive || m.active);
        this.activeMenu.set(active || null);
        this.loadingMenus.set(false);
      },
      error: () => this.loadingMenus.set(false)
    });
  }

  toggleActiveMenu(menu: Menu) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.menuService.update(tenantId, menu.id, { isActive: !(menu.isActive || menu.active) }).subscribe(() => {
      this.notify.success(
        !(menu.isActive || menu.active)
          ? this.transloco.translate('menu_history.activated')
          : this.transloco.translate('menu_history.deactivated')
      );
      this.loadMenuHistory();
    });
  }

  deleteMenu(menu: Menu) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: this.transloco.translate('menu_history.delete_confirm', { name: menu.name }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.cancel'),
    }).subscribe((confirmed) => {
      if (!confirmed) return;

      const tenantId = this.tenantCtx.currentTenantId();
      if (!tenantId) return;

      this.menuService.delete(tenantId, menu.id).subscribe({
        next: () => {
          this.notify.success(this.transloco.translate('notifications.menu_deleted'));
          this.loadMenuHistory();
        },
        error: () => {
          this.notify.error(this.transloco.translate('common.error'));
        }
      });
    });
  }

  private loadPatientProfile() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingProfile.set(true);
    this.userTenantRoleService.getPatientProfile(tenantId, this.userId).subscribe({
      next: (profile) => {
        this.patientProfile.set(profile);
        this.editProfileData.set({ ...(profile || {}) });
        this.lastSavedPayload = JSON.stringify(profile || {});
        this.loadingProfile.set(false);
      },
      error: () => this.loadingProfile.set(false)
    });
  }

  private loadPatientEvents(from?: string, to?: string) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingEvents.set(true);
    this.patientEventService.getByPatient(tenantId, this.userId, from, to).subscribe({
      next: (events) => {
        this.patientEvents.set(events || []);
        this.loadingEvents.set(false);
      },
      error: () => this.loadingEvents.set(false)
    });
  }

  private onPatientEventDatesSet(info: DatesSetArg) {
    const start = info.start.toISOString();
    const end = info.end.toISOString();
    this.loadPatientEvents(start, end);
  }

  handlePatientEventClick(info: EventClickArg) {
    const event = this.patientEvents().find(e => e.id === info.event.id);
    if (!event) return;

    if (this.canManagePatientEvents()) {
      this.confirm.confirm({
        content: this.transloco.translate('patient_events.delete_confirm'),
        label: event.title,
        yes: this.transloco.translate('common.delete'),
        no: this.transloco.translate('patient_events.edit_event'),
      }).subscribe((accepted) => {
        if (accepted) {
          this.deletePatientEvent(event);
        } else {
          this.showEventFormDialog(event);
        }
      });
    }
  }

  showEventFormDialog(event?: PatientEventDto) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.modal.open(PatientEventFormDialog, {
      label: this.transloco.translate(event ? 'patient_events.edit_event' : 'patient_events.new_event'),
      size: 's',
      data: { event, userId: this.userId }
    }).subscribe(() => {
      this.loadPatientEvents();
    });
  }

  private deletePatientEvent(event: PatientEventDto) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.patientEventService.delete(tenantId, event.id).subscribe({
      next: () => {
        this.notify.success(this.transloco.translate('patient_events.delete_success'), this.transloco.translate('common.success'));
        this.loadPatientEvents();
      },
      error: () => {
        this.notify.error(this.transloco.translate('patient_events.delete_error'), this.transloco.translate('common.error'));
      }
    });
  }

  private loadAppointments() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.canViewAppointments()) return;
    this.loadingAppointments.set(true);
    this.appointmentService.getByPatient(tenantId, this.userId).subscribe({
      next: (res) => {
        // Historial de citas: de la más reciente a la más antigua.
        const sorted = [...(res || [])].sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        this.appointments.set(sorted);
        this.loadingAppointments.set(false);
      },
      error: () => this.loadingAppointments.set(false)
    });
  }

  getStatusLabel(status: string): string {
    const key = `appointments.status_${status.toLowerCase()}`;
    return this.transloco.translate(key);
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'secondary' {
    switch (status) {
      case 'SCHEDULED': return 'info';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'secondary';
      case 'NO_SHOW': return 'warn';
      case 'PROPOSED': return 'warn';
      default: return 'info';
    }
  }

  /** Apariencia de `tuiBadge` para el estado de una cita. */
  getStatusAppearance(status: string): 'info' | 'positive' | 'neutral' | 'warning' {
    switch (status) {
      case 'COMPLETED': return 'positive';
      case 'CANCELLED': return 'neutral';
      case 'NO_SHOW': return 'warning';
      case 'PROPOSED': return 'warning';
      case 'SCHEDULED': return 'info';
      default: return 'info';
    }
  }

  /** Color del punto de la línea de tiempo del historial de citas. */
  timelineDotClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'border-ok bg-ok';
      case 'NO_SHOW': return 'border-err bg-err';
      case 'SCHEDULED':
      case 'PROPOSED': return 'border-accent bg-surface';
      default: return 'border-line-strong bg-surface';
    }
  }

  /** Resumen de asistencia del historial de citas. */
  readonly appointmentsMeta = computed(() => {
    const list = this.appointments();
    const attended = list.filter(a => a.status === 'COMPLETED').length;
    const missed = list.filter(a => a.status === 'NO_SHOW').length;
    const past = attended + missed;
    return { attended, missed, past, rate: past ? Math.round((attended / past) * 100) : 0 };
  });

  startEditGuidelines() {
    const profile = this.patientProfile();
    this.editBreakfast.set(profile?.breakfast ?? '');
    this.editLunch.set(profile?.lunch ?? '');
    this.editSnack.set(profile?.snack ?? '');
    this.editObservations.set(profile?.observations ?? '');
    this.editingGuidelines.set(true);
  }

  cancelEditGuidelines() {
    this.editingGuidelines.set(false);
  }

  saveGuidelines() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    const profile = this.patientProfile();
    if (!profile) return;

    this.savingGuidelines.set(true);
    const request: UserTenantProfileDto = {
      ...profile,
      breakfast: this.editBreakfast() || null,
      lunch: this.editLunch() || null,
      snack: this.editSnack() || null,
      observations: this.editObservations() || null
    };
    this.userTenantRoleService.updatePatientProfile(tenantId, this.userId, request).subscribe({
      next: () => {
        this.savingGuidelines.set(false);
        this.editingGuidelines.set(false);
        this.notify.success(this.transloco.translate('notifications.guidelines_saved'), this.transloco.translate('common.success'));
        this.loadPatientProfile();
      },
      error: () => {
        this.savingGuidelines.set(false);
        this.notify.error(this.transloco.translate('notifications.guidelines_error'), this.transloco.translate('common.error'));
      }
    });
  }

  showBoneMassDialog() {
    const currentBoneMass = this.patientProfile()?.boneMassKg ?? null;
    this.modal.open<boolean, BoneMassDialogInput>(BoneMassDialog, {
      label: this.transloco.translate('measurements.bone_mass_dialog_title'),
      size: 's',
      data: {
        userId: this.userId,
        boneMassKg: currentBoneMass,
        currentProfile: this.patientProfile()
      }
    }).subscribe((saved) => {
      if (saved) {
        this.loadPatientProfile();
      }
    });
  }

  calculateBodyComposition() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.userId) return;

    this.calculatingComposition.set(true);
    this.measurementService.calculateComposition(tenantId, this.userId).subscribe({
      next: () => {
        this.calculatingComposition.set(false);
        this.notify.success(
          this.transloco.translate('measurements.composition_calculated'),
          this.transloco.translate('common.success')
        );
        this.loadPatientProfile();
        this.loadMeasurements(this.page(), this.size());
        this.loadEvolution();
        this.loadUser();
      },
      error: () => {
        this.calculatingComposition.set(false);
        this.notify.error(
          this.transloco.translate('measurements.composition_calc_error'),
          this.transloco.translate('common.error')
        );
      }
    });
  }

  downloadCompositionPdf() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.userId) return;

    this.downloadingCompositionPdf.set(true);
    this.measurementService.downloadCompositionPdf(tenantId, this.userId).subscribe({
      next: (blob) => {
        this.downloadingCompositionPdf.set(false);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: (err: HttpErrorResponse) => {
        this.downloadingCompositionPdf.set(false);
        this.handleCompositionPdfError(err);
      }
    });
  }

  private handleCompositionPdfError(err: HttpErrorResponse) {
    const fallback = () => this.notify.error(
      this.transloco.translate('measurements.pdf_generic_error'),
      this.transloco.translate('common.error')
    );

    if (!(err.error instanceof Blob)) {
      fallback();
      return;
    }

    err.error.text().then((text: string) => {
      try {
        const parsed = JSON.parse(text) as { error?: string };
        this.notify.error(
          this.transloco.translate(this.mapCompositionPdfErrorKey(parsed.error)),
          this.transloco.translate('common.error')
        );
      } catch {
        fallback();
      }
    }).catch(fallback);
  }

  private mapCompositionPdfErrorKey(message?: string): string {
    switch (message) {
      case 'Tenant not found': return 'measurements.pdf_error_tenant_not_found';
      case 'User not found': return 'measurements.pdf_error_user_not_found';
      case 'Measurement not found': return 'measurements.pdf_error_measurement_not_found';
      case 'Body composition data unavailable': return 'measurements.pdf_error_composition_unavailable';
      default: return 'measurements.pdf_generic_error';
    }
  }

  getBodyFatBadgeAppearance(classification?: string | null): 'positive' | 'warning' | 'negative' | 'info' | 'neutral' {
    switch (classification) {
      case 'NORMAL': return 'positive';
      case 'LOW': return 'info';
      case 'OBESE': return 'warning';
      case 'OBESE_CLASS_I': return 'warning';
      case 'OBESE_CLASS_II': return 'negative';
      case 'OBESE_CLASS_III': return 'negative';
      default: return 'neutral';
    }
  }

  getBmiBadgeAppearance(classification?: string | null): 'positive' | 'warning' | 'info' | 'negative' {
    switch (classification) {
      case 'NORMAL': return 'positive';
      case 'UNDERWEIGHT': return 'info';
      case 'OVERWEIGHT': return 'warning';
      default: return 'negative';
    }
  }

  getRangeStatus(current: number | null | undefined, min: number | null | undefined, max: number | null | undefined): RangeStatus {
    if (current == null || min == null || max == null) return 'unknown';
    if (current < min) return 'below';
    if (current > max) return 'above';
    return 'within';
  }

  getRangeBadgeAppearance(status: RangeStatus): 'positive' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'within': return 'positive';
      case 'below':
      case 'above': return 'warning';
      default: return 'neutral';
    }
  }

  showRegisterDialog() {
    this.modal.open(MeasurementFormDialog, {
      label: this.transloco.translate('measurements.register'),
      size: 'l',
      data: { userId: this.userId }
    }).subscribe(() => {
      this.notify.success(this.transloco.translate('notifications.measurement_registered'), this.transloco.translate('common.success'));
      this.loadMeasurements(0, this.size());
      this.loadEvolution();
      this.loadPatientProfile();
    });
  }

  uploadMenuOcr() {
    this.modal.open<Menu, { user?: AppUserDto | null }>(MenuUploadDialog, {
      label: this.transloco.translate('templates.upload_ocr'),
      size: 'l',
      data: { user: this.user() }
    }).subscribe((createdMenu) => {
      this.notify.success(this.transloco.translate('notifications.menu_created'));
      this.loadMenuHistory();
      if (createdMenu?.id) {
        this.router.navigate(['/menus', createdMenu.id]);
      }
    });
  }

  showCreateMenuDialog() {
    this.modal.open(MenuFormDialog, {
      label: this.transloco.translate('menu_history.create_menu_dialog'),
      size: 's',
      data: { userId: this.userId }
    }).subscribe(() => {
      this.notify.success(this.transloco.translate('notifications.menu_created'));
      this.loadMenuHistory();
    });
  }

  showAssignTemplateDialog() {
    this.modal.open(AssignMenuTemplateDialog, {
      label: this.transloco.translate('menu_history.assign_template_dialog'),
      size: 's',
      data: { userId: this.userId }
    }).subscribe(() => {
      this.notify.success(this.transloco.translate('notifications.template_assigned'));
      this.loadMenuHistory();
    });
  }

  showEditDialog() {
    const current = this.user();
    if (!current) return;
    this.modal.open(EditUserDialog, {
      label: this.transloco.translate('users.edit_user_title'),
      size: 'm',
      data: { user: current }
    }).subscribe(() => {
      this.loadUser();
    });
  }

  /**
   * Agendado rápido en diálogo (mismo `QuickScheduleWidget` del panel). El
   * paciente de la ficha ya viene seleccionado; para un miembro del equipo se
   * agenda con él como profesional.
   */
  showNewAppointmentDialog() {
    const current = this.user();
    if (!current) return;

    const isPatient = current.userType === 'PATIENT';
    const patientLabel = `${current.firstName ?? ''} ${current.lastName ?? ''}`.trim() || current.email;

    this.modal.open<boolean, QuickScheduleDialogData>(QuickScheduleDialog, {
      label: this.transloco.translate('appointments.schedule_new'),
      size: 'l',
      data: isPatient
        ? { patientId: current.id, patientLabel, patientEmail: current.email }
        : { nutritionistId: current.id }
    }).subscribe((created) => {
      if (created) this.loadAppointments();
    });
  }

  showAssignNutritionistDialog() {
    const current = this.user();
    if (!current) return;
    this.modal.open<AppUserDto | true, AssignNutritionistDialogInput>(AssignNutritionistDialog, {
      label: this.transloco.translate('users.assign_nutritionist_title'),
      size: 's',
      data: {
        patientId: current.id,
        patientName: `${current.firstName} ${current.lastName}`.trim(),
        assignedNutritionistId: this.assignedNutritionist().id
      }
    }).subscribe(() => {
      this.loadUser();
    });
  }

  resetPassword() {
    const currentUser = this.user();
    const tenantId = this.tenantCtx.currentTenantId();
    if (!currentUser || !tenantId) return;

    const name = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || '';
    const email = currentUser.email || '';

    forkJoin({
      title: this.transloco.selectTranslate('users.reset_password_confirm_title').pipe(take(1)),
      msg: this.transloco.selectTranslate('users.reset_password_confirm_msg', { name, email }).pipe(take(1)),
      yes: this.transloco.selectTranslate('users.reset_password_confirm_btn').pipe(take(1)),
      no: this.transloco.selectTranslate('common.cancel').pipe(take(1))
    }).subscribe((texts) => {
      this.confirm.confirm({
        label: texts.title,
        content: texts.msg,
        yes: texts.yes,
        no: texts.no,
        size: 'm'
      }).subscribe((accepted) => {
        if (accepted) {
          this.isSendingResetPassword.set(true);
          this.userTenantRoleService.sendResetPassword(tenantId, currentUser.id).subscribe({
            next: () => {
              this.isSendingResetPassword.set(false);
              this.notify.success(
                this.transloco.translate('users.reset_password_success'),
                this.transloco.translate('common.success')
              );
            },
            error: () => {
              this.isSendingResetPassword.set(false);
              this.notify.error(
                this.transloco.translate('users.reset_password_error'),
                this.transloco.translate('common.error')
              );
            }
          });
        }
      });
    });
  }

  deleteMeasurement(measurement: BodyMeasurementDto) {
    const date = formatInstant(measurement.measuredAt);
    this.confirm.confirm({
      content: this.transloco.translate('measurements.delete_confirm_msg', { date }),
      label: this.transloco.translate('common.attention'),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.cancel'),
    }).subscribe((accepted) => {
      if (accepted) {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.measurementService.delete(tenantId, this.userId, measurement.id).subscribe({
            next: () => {
              this.notify.success(this.transloco.translate('notifications.measurement_deleted'), this.transloco.translate('common.success'));
              this.loadMeasurements(this.page(), this.size());
              this.loadEvolution();
            }
           });
         }
       }
     });
   }

  ngOnDestroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    if (this.saveSub) {
      this.saveSub.unsubscribe();
    }
    if (this.savedStatusTimeout) {
      clearTimeout(this.savedStatusTimeout);
    }
  }
 }
