/**
 * Help/Manual Content Model - Single Source of Truth
 * 16 sections × 62 topics total
 * Organized by role: common (3), nutritionist (8), patient (5)
 */

export interface HelpTopic {
  id: string;
  titleKey: string;           // i18n key in help.topics.{section_id}.{topic_id}.title
  descKey: string;            // i18n key in help.topics.{section_id}.{topic_id}.desc
  steps?: string[];           // i18n keys for numbered steps (optional)
  screenshot?: {              // relative paths to assets/help/screenshots/
    light: string;
    dark: string;
  };
  relatedRoutes?: string[];   // Angular routes related to this topic
  tags?: string[];            // search tags (optional, for better UX)
}

export interface HelpSection {
  id: string;
  titleKey: string;           // i18n key in help.sections.{section_id}
  icon: string;               // FontAwesome class
  topics: HelpTopic[];
  roles: ('nutritionist' | 'patient' | 'common')[];  // who can see this
  order: number;              // sort order
}

// ============================================================================
// CENTRAL CONTENT DEFINITION - 16 SECTIONS, 62 TOPICS
// ============================================================================

export const HELP_CONTENT: HelpSection[] = [
  // ========== COMMON SECTIONS (3 sections, 10 topics) ==========
  
  {
    id: 'access',
    titleKey: 'help.sections.access',
    icon: 'fa-solid fa-key',
    roles: ['common'],
    order: 1,
    topics: [
      {
        id: 'login',
        titleKey: 'help.topics.access.login.title',
        descKey: 'help.topics.access.login.desc',
        steps: [
          'help.topics.access.login.step1',
          'help.topics.access.login.step2',
          'help.topics.access.login.step3',
        ],
        screenshot: { light: 'help-overview/light/desktop/nutritionist.png', dark: 'help-overview/dark/desktop/nutritionist.png' },
        tags: ['login', 'keycloak', 'password'],
      },
      {
        id: 'switch_tenant',
        titleKey: 'help.topics.access.switch_tenant.title',
        descKey: 'help.topics.access.switch_tenant.desc',
        steps: [
          'help.topics.access.switch_tenant.step1',
          'help.topics.access.switch_tenant.step2',
          'help.topics.access.switch_tenant.step3',
        ],
        screenshot: { light: 'common-getting-started/light/desktop/nutritionist.png', dark: 'common-getting-started/dark/desktop/nutritionist.png' },
        tags: ['switch', 'clinic', 'tenant', 'organization'],
        relatedRoutes: ['/shell'],
      },
      {
        id: 'recover_password',
        titleKey: 'help.topics.access.recover_password.title',
        descKey: 'help.topics.access.recover_password.desc',
        steps: [
          'help.topics.access.recover_password.step1',
          'help.topics.access.recover_password.step2',
          'help.topics.access.recover_password.step3',
        ],
        tags: ['password', 'recover', 'forgot', 'reset'],
      },
    ],
  },

  {
    id: 'preferences',
    titleKey: 'help.sections.preferences',
    icon: 'fa-solid fa-sliders',
    roles: ['common'],
    order: 2,
    topics: [
      {
        id: 'theme',
        titleKey: 'help.topics.preferences.theme.title',
        descKey: 'help.topics.preferences.theme.desc',
        steps: [
          'help.topics.preferences.theme.step1',
          'help.topics.preferences.theme.step2',
        ],
        screenshot: { light: 'common/light/desktop/theme-light.png', dark: 'common/dark/desktop/theme-dark.png' },
        tags: ['dark', 'light', 'mode', 'theme', 'appearance'],
      },
      {
        id: 'language',
        titleKey: 'help.topics.preferences.language.title',
        descKey: 'help.topics.preferences.language.desc',
        steps: [
          'help.topics.preferences.language.step1',
          'help.topics.preferences.language.step2',
        ],
        tags: ['language', 'idioma', 'español', 'english', 'i18n'],
      },
      {
        id: 'notifications',
        titleKey: 'help.topics.preferences.notifications.title',
        descKey: 'help.topics.preferences.notifications.desc',
        steps: [
          'help.topics.preferences.notifications.step1',
          'help.topics.preferences.notifications.step2',
        ],
        tags: ['notifications', 'alerts', 'email', 'push'],
      },
    ],
  },

  {
    id: 'shortcuts',
    titleKey: 'help.sections.shortcuts',
    icon: 'fa-solid fa-keyboard',
    roles: ['common'],
    order: 3,
    topics: [
      {
        id: 'keyboard',
        titleKey: 'help.topics.shortcuts.keyboard.title',
        descKey: 'help.topics.shortcuts.keyboard.desc',
        steps: [
          'help.topics.shortcuts.keyboard.step1',
          'help.topics.shortcuts.keyboard.step2',
          'help.topics.shortcuts.keyboard.step3',
        ],
        tags: ['keyboard', 'shortcut', 'navigation', 'accessibility'],
      },
      {
        id: 'search',
        titleKey: 'help.topics.shortcuts.search.title',
        descKey: 'help.topics.shortcuts.search.desc',
        steps: [
          'help.topics.shortcuts.search.step1',
          'help.topics.shortcuts.search.step2',
        ],
        tags: ['search', 'ctrl+k', 'global', 'find'],
      },
      {
        id: 'breadcrumbs',
        titleKey: 'help.topics.shortcuts.breadcrumbs.title',
        descKey: 'help.topics.shortcuts.breadcrumbs.desc',
        tags: ['breadcrumb', 'navigation', 'trail'],
      },
    ],
  },

  // ========== NUTRITIONIST SECTIONS (8 sections, 32 topics) ==========

  {
    id: 'dashboard_nutri',
    titleKey: 'help.sections.dashboard_nutri',
    icon: 'fa-solid fa-chart-line',
    roles: ['nutritionist'],
    order: 10,
    topics: [
      {
        id: 'overview',
        titleKey: 'help.topics.dashboard_nutri.overview.title',
        descKey: 'help.topics.dashboard_nutri.overview.desc',
        screenshot: { light: 'nutritionist/light/desktop/dashboard.png', dark: 'nutritionist/dark/desktop/dashboard.png' },
        tags: ['dashboard', 'overview', 'home', 'widgets'],
        relatedRoutes: ['/shell/tenant-dashboard'],
      },
      {
        id: 'widgets',
        titleKey: 'help.topics.dashboard_nutri.widgets.title',
        descKey: 'help.topics.dashboard_nutri.widgets.desc',
        steps: [
          'help.topics.dashboard_nutri.widgets.step1',
          'help.topics.dashboard_nutri.widgets.step2',
        ],
        tags: ['widget', 'card', 'metric', 'kpi'],
      },
      {
        id: 'quick_actions',
        titleKey: 'help.topics.dashboard_nutri.quick_actions.title',
        descKey: 'help.topics.dashboard_nutri.quick_actions.desc',
        steps: [
          'help.topics.dashboard_nutri.quick_actions.step1',
          'help.topics.dashboard_nutri.quick_actions.step2',
        ],
        tags: ['quick', 'action', 'button', 'create'],
      },
      {
        id: 'appointments_proposed',
        titleKey: 'help.topics.dashboard_nutri.appointments_proposed.title',
        descKey: 'help.topics.dashboard_nutri.appointments_proposed.desc',
        steps: [
          'help.topics.dashboard_nutri.appointments_proposed.step1',
          'help.topics.dashboard_nutri.appointments_proposed.step2',
        ],
        tags: ['appointment', 'proposal', 'suggestion', 'calendar'],
        relatedRoutes: ['/shell/appointments'],
      },
    ],
  },

  {
    id: 'patients',
    titleKey: 'help.sections.patients',
    icon: 'fa-solid fa-users',
    roles: ['nutritionist'],
    order: 20,
    topics: [
      {
        id: 'list_view',
        titleKey: 'help.topics.patients.list_view.title',
        descKey: 'help.topics.patients.list_view.desc',
        screenshot: { light: 'nutritionist/light/desktop/patients.png', dark: 'nutritionist/dark/desktop/patients.png' },
        tags: ['list', 'table', 'patients', 'view'],
        relatedRoutes: ['/shell/users/PATIENT'],
      },
      {
        id: 'search_filter',
        titleKey: 'help.topics.patients.search_filter.title',
        descKey: 'help.topics.patients.search_filter.desc',
        steps: [
          'help.topics.patients.search_filter.step1',
          'help.topics.patients.search_filter.step2',
        ],
        tags: ['search', 'filter', 'find', 'query'],
      },
      {
        id: 'invite_patient',
        titleKey: 'help.topics.patients.invite_patient.title',
        descKey: 'help.topics.patients.invite_patient.desc',
        steps: [
          'help.topics.patients.invite_patient.step1',
          'help.topics.patients.invite_patient.step2',
          'help.topics.patients.invite_patient.step3',
        ],
        screenshot: { light: 'nutritionist/light/desktop/patients-invite-modal.png', dark: 'nutritionist/dark/desktop/patients-invite-modal.png' },
        tags: ['invite', 'add', 'create', 'new', 'patient', 'email'],
        relatedRoutes: ['/shell/users/PATIENT'],
      },
      {
        id: 'edit_patient',
        titleKey: 'help.topics.patients.edit_patient.title',
        descKey: 'help.topics.patients.edit_patient.desc',
        steps: [
          'help.topics.patients.edit_patient.step1',
          'help.topics.patients.edit_patient.step2',
          'help.topics.patients.edit_patient.step3',
        ],
        tags: ['edit', 'update', 'modify', 'patient'],
      },
      {
        id: 'activate_deactivate',
        titleKey: 'help.topics.patients.activate_deactivate.title',
        descKey: 'help.topics.patients.activate_deactivate.desc',
        steps: [
          'help.topics.patients.activate_deactivate.step1',
          'help.topics.patients.activate_deactivate.step2',
        ],
        tags: ['activate', 'deactivate', 'status', 'enable', 'disable'],
      },
      {
        id: 'view_details',
        titleKey: 'help.topics.patients.view_details.title',
        descKey: 'help.topics.patients.view_details.desc',
        steps: [
          'help.topics.patients.view_details.step1',
          'help.topics.patients.view_details.step2',
        ],
        tags: ['view', 'detail', 'profile', 'information'],
        relatedRoutes: ['/shell/users/:id'],
      },
    ],
  },

  {
    id: 'patient_detail',
    titleKey: 'help.sections.patient_detail',
    icon: 'fa-solid fa-user',
    roles: ['nutritionist'],
    order: 30,
    topics: [
      {
        id: 'profile_tab',
        titleKey: 'help.topics.patient_detail.profile_tab.title',
        descKey: 'help.topics.patient_detail.profile_tab.desc',
        screenshot: { light: 'nutritionist/light/desktop/patient-detail.png', dark: 'nutritionist/dark/desktop/patient-detail.png' },
        tags: ['profile', 'personal', 'data', 'information'],
      },
      {
        id: 'measurements_tab',
        titleKey: 'help.topics.patient_detail.measurements_tab.title',
        descKey: 'help.topics.patient_detail.measurements_tab.desc',
        steps: [
          'help.topics.patient_detail.measurements_tab.step1',
          'help.topics.patient_detail.measurements_tab.step2',
        ],
        tags: ['measurement', 'weight', 'height', 'bmi', 'graph', 'chart'],
      },
      {
        id: 'menus_assigned',
        titleKey: 'help.topics.patient_detail.menus_assigned.title',
        descKey: 'help.topics.patient_detail.menus_assigned.desc',
        steps: [
          'help.topics.patient_detail.menus_assigned.step1',
          'help.topics.patient_detail.menus_assigned.step2',
        ],
        tags: ['menu', 'assign', 'diet', 'meal'],
      },
      {
        id: 'water_tab',
        titleKey: 'help.topics.patient_detail.water_tab.title',
        descKey: 'help.topics.patient_detail.water_tab.desc',
        tags: ['water', 'hydration', 'intake', 'ml'],
      },
      {
        id: 'clinical_profile',
        titleKey: 'help.topics.patient_detail.clinical_profile.title',
        descKey: 'help.topics.patient_detail.clinical_profile.desc',
        steps: [
          'help.topics.patient_detail.clinical_profile.step1',
          'help.topics.patient_detail.clinical_profile.step2',
        ],
        tags: ['clinical', 'allergies', 'habits', 'health', 'anamnesis'],
      },
      {
        id: 'fixed_guidelines',
        titleKey: 'help.topics.patient_detail.fixed_guidelines.title',
        descKey: 'help.topics.patient_detail.fixed_guidelines.desc',
        tags: ['guideline', 'rule', 'protocol', 'instruction'],
      },
      {
        id: 'events_tab',
        titleKey: 'help.topics.patient_detail.events_tab.title',
        descKey: 'help.topics.patient_detail.events_tab.desc',
        steps: [
          'help.topics.patient_detail.events_tab.step1',
          'help.topics.patient_detail.events_tab.step2',
        ],
        tags: ['event', 'timeline', 'history', 'log'],
      },
      {
        id: 'appointments_history',
        titleKey: 'help.topics.patient_detail.appointments_history.title',
        descKey: 'help.topics.patient_detail.appointments_history.desc',
        tags: ['appointment', 'history', 'session', 'visit'],
      },
    ],
  },

  {
    id: 'staff',
    titleKey: 'help.sections.staff',
    icon: 'fa-solid fa-user-doctor',
    roles: ['nutritionist'],
    order: 40,
    topics: [
      {
        id: 'list_view',
        titleKey: 'help.topics.staff.list_view.title',
        descKey: 'help.topics.staff.list_view.desc',
        screenshot: { light: 'nutritionist/light/desktop/staff.png', dark: 'nutritionist/dark/desktop/staff.png' },
        tags: ['staff', 'team', 'list', 'members'],
        relatedRoutes: ['/shell/users/STAFF'],
      },
      {
        id: 'invite_staff',
        titleKey: 'help.topics.staff.invite_staff.title',
        descKey: 'help.topics.staff.invite_staff.desc',
        steps: [
          'help.topics.staff.invite_staff.step1',
          'help.topics.staff.invite_staff.step2',
          'help.topics.staff.invite_staff.step3',
        ],
        screenshot: { light: 'nutritionist/light/desktop/staff-invite-modal.png', dark: 'nutritionist/dark/desktop/staff-invite-modal.png' },
        tags: ['invite', 'add', 'staff', 'team', 'member'],
      },
      {
        id: 'edit_roles',
        titleKey: 'help.topics.staff.edit_roles.title',
        descKey: 'help.topics.staff.edit_roles.desc',
        steps: [
          'help.topics.staff.edit_roles.step1',
          'help.topics.staff.edit_roles.step2',
        ],
        tags: ['edit', 'role', 'permission', 'staff'],
      },
      {
        id: 'remove_staff',
        titleKey: 'help.topics.staff.remove_staff.title',
        descKey: 'help.topics.staff.remove_staff.desc',
        steps: [
          'help.topics.staff.remove_staff.step1',
          'help.topics.staff.remove_staff.step2',
        ],
        tags: ['remove', 'delete', 'staff', 'member'],
      },
    ],
  },

  {
    id: 'appointments',
    titleKey: 'help.sections.appointments',
    icon: 'fa-solid fa-calendar-days',
    roles: ['nutritionist'],
    order: 50,
    topics: [
      {
        id: 'calendar_view',
        titleKey: 'help.topics.appointments.calendar_view.title',
        descKey: 'help.topics.appointments.calendar_view.desc',
        screenshot: { light: 'nutritionist/light/desktop/appointments.png', dark: 'nutritionist/dark/desktop/appointments.png' },
        tags: ['calendar', 'view', 'month', 'week', 'day'],
        relatedRoutes: ['/shell/appointments'],
      },
      {
        id: 'create_appointment',
        titleKey: 'help.topics.appointments.create_appointment.title',
        descKey: 'help.topics.appointments.create_appointment.desc',
        steps: [
          'help.topics.appointments.create_appointment.step1',
          'help.topics.appointments.create_appointment.step2',
          'help.topics.appointments.create_appointment.step3',
        ],
        screenshot: { light: 'nutritionist/light/desktop/appointments-create-modal.png', dark: 'nutritionist/dark/desktop/appointments-create-modal.png' },
        tags: ['create', 'new', 'appointment', 'schedule', 'session'],
      },
      {
        id: 'attend_appointment',
        titleKey: 'help.topics.appointments.attend_appointment.title',
        descKey: 'help.topics.appointments.attend_appointment.desc',
        steps: [
          'help.topics.appointments.attend_appointment.step1',
          'help.topics.appointments.attend_appointment.step2',
        ],
        tags: ['attend', 'mark', 'present', 'session'],
      },
      {
        id: 'cancel_appointment',
        titleKey: 'help.topics.appointments.cancel_appointment.title',
        descKey: 'help.topics.appointments.cancel_appointment.desc',
        steps: [
          'help.topics.appointments.cancel_appointment.step1',
          'help.topics.appointments.cancel_appointment.step2',
        ],
        tags: ['cancel', 'delete', 'appointment', 'session'],
      },
      {
        id: 'no_show',
        titleKey: 'help.topics.appointments.no_show.title',
        descKey: 'help.topics.appointments.no_show.desc',
        steps: [
          'help.topics.appointments.no_show.step1',
          'help.topics.appointments.no_show.step2',
        ],
        tags: ['no show', 'no-show', 'absent', 'did not attend'],
      },
      {
        id: 'proposed_appointments',
        titleKey: 'help.topics.appointments.proposed_appointments.title',
        descKey: 'help.topics.appointments.proposed_appointments.desc',
        steps: [
          'help.topics.appointments.proposed_appointments.step1',
          'help.topics.appointments.proposed_appointments.step2',
        ],
        tags: ['proposal', 'suggestion', 'ai', 'algorithm'],
      },
    ],
  },

  {
    id: 'revenue',
    titleKey: 'help.sections.revenue',
    icon: 'fa-solid fa-chart-line',
    roles: ['nutritionist'],
    order: 60,
    topics: [
      {
        id: 'overview',
        titleKey: 'help.topics.revenue.overview.title',
        descKey: 'help.topics.revenue.overview.desc',
        screenshot: { light: 'nutritionist/light/desktop/revenue.png', dark: 'nutritionist/dark/desktop/revenue.png' },
        tags: ['revenue', 'income', 'earnings', 'chart'],
        relatedRoutes: ['/shell/revenue'],
      },
      {
        id: 'charts_metrics',
        titleKey: 'help.topics.revenue.charts_metrics.title',
        descKey: 'help.topics.revenue.charts_metrics.desc',
        steps: [
          'help.topics.revenue.charts_metrics.step1',
          'help.topics.revenue.charts_metrics.step2',
        ],
        tags: ['chart', 'metric', 'graph', 'analysis'],
      },
      {
        id: 'time_granularity',
        titleKey: 'help.topics.revenue.time_granularity.title',
        descKey: 'help.topics.revenue.time_granularity.desc',
        steps: [
          'help.topics.revenue.time_granularity.step1',
          'help.topics.revenue.time_granularity.step2',
        ],
        tags: ['time', 'period', 'day', 'week', 'month', 'granularity'],
      },
      {
        id: 'filter_by_staff',
        titleKey: 'help.topics.revenue.filter_by_staff.title',
        descKey: 'help.topics.revenue.filter_by_staff.desc',
        steps: [
          'help.topics.revenue.filter_by_staff.step1',
          'help.topics.revenue.filter_by_staff.step2',
        ],
        tags: ['filter', 'staff', 'nutritionist', 'member'],
      },
    ],
  },

  {
    id: 'menus_templates',
    titleKey: 'help.sections.menus_templates',
    icon: 'fa-solid fa-utensils',
    roles: ['nutritionist'],
    order: 70,
    topics: [
      {
        id: 'menus_list',
        titleKey: 'help.topics.menus_templates.menus_list.title',
        descKey: 'help.topics.menus_templates.menus_list.desc',
        screenshot: { light: 'nutritionist/light/desktop/menus.png', dark: 'nutritionist/dark/desktop/menus.png' },
        tags: ['menu', 'list', 'view', 'diet'],
        relatedRoutes: ['/shell/menus'],
      },
      {
        id: 'create_manual_menu',
        titleKey: 'help.topics.menus_templates.create_manual_menu.title',
        descKey: 'help.topics.menus_templates.create_manual_menu.desc',
        steps: [
          'help.topics.menus_templates.create_manual_menu.step1',
          'help.topics.menus_templates.create_manual_menu.step2',
          'help.topics.menus_templates.create_manual_menu.step3',
        ],
        screenshot: { light: 'nutritionist/light/desktop/menus-create-modal.png', dark: 'nutritionist/dark/desktop/menus-create-modal.png' },
        tags: ['create', 'menu', 'manual', 'new'],
      },
      {
        id: 'upload_ai_menu',
        titleKey: 'help.topics.menus_templates.upload_ai_menu.title',
        descKey: 'help.topics.menus_templates.upload_ai_menu.desc',
        steps: [
          'help.topics.menus_templates.upload_ai_menu.step1',
          'help.topics.menus_templates.upload_ai_menu.step2',
          'help.topics.menus_templates.upload_ai_menu.step3',
        ],
        screenshot: { light: 'nutritionist/light/desktop/menus-upload-modal.png', dark: 'nutritionist/dark/desktop/menus-upload-modal.png' },
        tags: ['upload', 'ai', 'menu', 'file'],
      },
      {
        id: 'edit_meals',
        titleKey: 'help.topics.menus_templates.edit_meals.title',
        descKey: 'help.topics.menus_templates.edit_meals.desc',
        steps: [
          'help.topics.menus_templates.edit_meals.step1',
          'help.topics.menus_templates.edit_meals.step2',
        ],
        screenshot: { light: 'nutritionist/light/desktop/menus-detail.png', dark: 'nutritionist/dark/desktop/menus-detail.png' },
        tags: ['edit', 'meal', 'food', 'ingredient'],
      },
      {
        id: 'assign_menu',
        titleKey: 'help.topics.menus_templates.assign_menu.title',
        descKey: 'help.topics.menus_templates.assign_menu.desc',
        steps: [
          'help.topics.menus_templates.assign_menu.step1',
          'help.topics.menus_templates.assign_menu.step2',
        ],
        tags: ['assign', 'menu', 'patient', 'diet'],
      },
      {
        id: 'templates_list',
        titleKey: 'help.topics.menus_templates.templates_list.title',
        descKey: 'help.topics.menus_templates.templates_list.desc',
        screenshot: { light: 'nutritionist/light/desktop/templates.png', dark: 'nutritionist/dark/desktop/templates.png' },
        tags: ['template', 'list', 'view', 'reusable'],
        relatedRoutes: ['/shell/templates'],
      },
      {
        id: 'create_template',
        titleKey: 'help.topics.menus_templates.create_template.title',
        descKey: 'help.topics.menus_templates.create_template.desc',
        steps: [
          'help.topics.menus_templates.create_template.step1',
          'help.topics.menus_templates.create_template.step2',
        ],
        tags: ['create', 'template', 'reusable'],
      },
      {
        id: 'instantiate_template',
        titleKey: 'help.topics.menus_templates.instantiate_template.title',
        descKey: 'help.topics.menus_templates.instantiate_template.desc',
        steps: [
          'help.topics.menus_templates.instantiate_template.step1',
          'help.topics.menus_templates.instantiate_template.step2',
        ],
        tags: ['instantiate', 'create from template', 'use template'],
      },
    ],
  },

  {
    id: 'settings',
    titleKey: 'help.sections.settings',
    icon: 'fa-solid fa-sliders',
    roles: ['nutritionist'],
    order: 80,
    topics: [
      {
        id: 'branding',
        titleKey: 'help.topics.settings.branding.title',
        descKey: 'help.topics.settings.branding.desc',
        steps: [
          'help.topics.settings.branding.step1',
          'help.topics.settings.branding.step2',
        ],
        screenshot: { light: 'nutritionist/light/desktop/settings.png', dark: 'nutritionist/dark/desktop/settings.png' },
        tags: ['branding', 'logo', 'color', 'theme', 'clinic'],
        relatedRoutes: ['/shell/settings'],
      },
      {
        id: 'appointment_types',
        titleKey: 'help.topics.settings.appointment_types.title',
        descKey: 'help.topics.settings.appointment_types.desc',
        steps: [
          'help.topics.settings.appointment_types.step1',
          'help.topics.settings.appointment_types.step2',
        ],
        tags: ['appointment', 'type', 'session', 'cita'],
      },
      {
        id: 'anamnesis',
        titleKey: 'help.topics.settings.anamnesis.title',
        descKey: 'help.topics.settings.anamnesis.desc',
        steps: [
          'help.topics.settings.anamnesis.step1',
          'help.topics.settings.anamnesis.step2',
        ],
        tags: ['anamnesis', 'medical', 'history', 'form', 'clinical'],
      },
      {
        id: 'schedule',
        titleKey: 'help.topics.settings.schedule.title',
        descKey: 'help.topics.settings.schedule.desc',
        steps: [
          'help.topics.settings.schedule.step1',
          'help.topics.settings.schedule.step2',
        ],
        tags: ['schedule', 'hours', 'availability', 'working hours'],
      },
      {
        id: 'clinic_address',
        titleKey: 'help.topics.settings.clinic_address.title',
        descKey: 'help.topics.settings.clinic_address.desc',
        steps: [
          'help.topics.settings.clinic_address.step1',
          'help.topics.settings.clinic_address.step2',
        ],
        tags: ['address', 'clinic', 'location', 'contact'],
      },
    ],
  },

  // ========== PATIENT SECTIONS (5 sections, 20 topics) ==========
  // NOTE: roles include BOTH 'nutritionist' and 'patient' so nutritionists can see these

  {
    id: 'dashboard_patient',
    titleKey: 'help.sections.dashboard_patient',
    icon: 'fa-solid fa-house-medical',
    roles: ['nutritionist', 'patient'],
    order: 100,
    topics: [
      {
        id: 'overview',
        titleKey: 'help.topics.dashboard_patient.overview.title',
        descKey: 'help.topics.dashboard_patient.overview.desc',
        screenshot: { light: 'patient/light/desktop/dashboard.png', dark: 'patient/dark/desktop/dashboard.png' },
        tags: ['dashboard', 'overview', 'home', 'patient'],
        relatedRoutes: ['/shell/tenant-dashboard'],
      },
      {
        id: 'water_tracking',
        titleKey: 'help.topics.dashboard_patient.water_tracking.title',
        descKey: 'help.topics.dashboard_patient.water_tracking.desc',
        steps: [
          'help.topics.dashboard_patient.water_tracking.step1',
          'help.topics.dashboard_patient.water_tracking.step2',
        ],
        tags: ['water', 'hydration', 'intake', 'ml', 'tracking'],
      },
      {
        id: 'upcoming_appointment',
        titleKey: 'help.topics.dashboard_patient.upcoming_appointment.title',
        descKey: 'help.topics.dashboard_patient.upcoming_appointment.desc',
        tags: ['appointment', 'next', 'upcoming', 'calendar', 'cita'],
      },
      {
        id: 'todays_meals',
        titleKey: 'help.topics.dashboard_patient.todays_meals.title',
        descKey: 'help.topics.dashboard_patient.todays_meals.desc',
        tags: ['meal', 'today', 'food', 'menu', 'diet'],
      },
      {
        id: 'weight_graph',
        titleKey: 'help.topics.dashboard_patient.weight_graph.title',
        descKey: 'help.topics.dashboard_patient.weight_graph.desc',
        tags: ['weight', 'graph', 'chart', 'measurement', 'progress'],
      },
      {
        id: 'shopping_list_widget',
        titleKey: 'help.topics.dashboard_patient.shopping_list_widget.title',
        descKey: 'help.topics.dashboard_patient.shopping_list_widget.desc',
        tags: ['shopping', 'list', 'widget', 'ingredients'],
      },
    ],
  },

  {
    id: 'my_diets',
    titleKey: 'help.sections.my_diets',
    icon: 'fa-solid fa-utensils',
    roles: ['nutritionist', 'patient'],
    order: 110,
    topics: [
      {
        id: 'view_menus',
        titleKey: 'help.topics.my_diets.view_menus.title',
        descKey: 'help.topics.my_diets.view_menus.desc',
        screenshot: { light: 'patient/light/desktop/menus.png', dark: 'patient/dark/desktop/menus.png' },
        tags: ['menu', 'diet', 'view', 'list'],
        relatedRoutes: ['/shell/menus'],
      },
      {
        id: 'weekly_detail',
        titleKey: 'help.topics.my_diets.weekly_detail.title',
        descKey: 'help.topics.my_diets.weekly_detail.desc',
        steps: [
          'help.topics.my_diets.weekly_detail.step1',
          'help.topics.my_diets.weekly_detail.step2',
        ],
        screenshot: { light: 'patient/light/desktop/menu-detail.png', dark: 'patient/dark/desktop/menu-detail.png' },
        tags: ['weekly', 'detail', 'meal', 'day', 'week'],
      },
      {
        id: 'download_pdf',
        titleKey: 'help.topics.my_diets.download_pdf.title',
        descKey: 'help.topics.my_diets.download_pdf.desc',
        steps: [
          'help.topics.my_diets.download_pdf.step1',
          'help.topics.my_diets.download_pdf.step2',
        ],
        tags: ['download', 'pdf', 'export', 'menu'],
      },
      {
        id: 'meal_details',
        titleKey: 'help.topics.my_diets.meal_details.title',
        descKey: 'help.topics.my_diets.meal_details.desc',
        steps: [
          'help.topics.my_diets.meal_details.step1',
          'help.topics.my_diets.meal_details.step2',
        ],
        tags: ['meal', 'food', 'ingredient', 'details', 'nutrients'],
      },
    ],
  },

  {
    id: 'shopping_list',
    titleKey: 'help.sections.shopping_list',
    icon: 'fa-solid fa-cart-shopping',
    roles: ['nutritionist', 'patient'],
    order: 120,
    topics: [
      {
        id: 'view_list',
        titleKey: 'help.topics.shopping_list.view_list.title',
        descKey: 'help.topics.shopping_list.view_list.desc',
        screenshot: { light: 'patient/light/desktop/shopping-list.png', dark: 'patient/dark/desktop/shopping-list.png' },
        tags: ['shopping', 'list', 'groceries', 'ingredients'],
        relatedRoutes: ['/shell/shopping-lists'],
      },
      {
        id: 'grouped_by_store',
        titleKey: 'help.topics.shopping_list.grouped_by_store.title',
        descKey: 'help.topics.shopping_list.grouped_by_store.desc',
        steps: [
          'help.topics.shopping_list.grouped_by_store.step1',
          'help.topics.shopping_list.grouped_by_store.step2',
        ],
        tags: ['group', 'store', 'supermarket', 'section'],
      },
      {
        id: 'mark_purchased',
        titleKey: 'help.topics.shopping_list.mark_purchased.title',
        descKey: 'help.topics.shopping_list.mark_purchased.desc',
        steps: [
          'help.topics.shopping_list.mark_purchased.step1',
          'help.topics.shopping_list.mark_purchased.step2',
        ],
        tags: ['mark', 'check', 'purchased', 'bought', 'checkbox'],
      },
      {
        id: 'share_list',
        titleKey: 'help.topics.shopping_list.share_list.title',
        descKey: 'help.topics.shopping_list.share_list.desc',
        steps: [
          'help.topics.shopping_list.share_list.step1',
          'help.topics.shopping_list.share_list.step2',
        ],
        tags: ['share', 'export', 'send', 'email'],
      },
    ],
  },

  {
    id: 'my_profile',
    titleKey: 'help.sections.my_profile',
    icon: 'fa-solid fa-user',
    roles: ['nutritionist', 'patient'],
    order: 130,
    topics: [
      {
        id: 'personal_data',
        titleKey: 'help.topics.my_profile.personal_data.title',
        descKey: 'help.topics.my_profile.personal_data.desc',
        screenshot: { light: 'patient/light/desktop/profile.png', dark: 'patient/dark/desktop/profile.png' },
        tags: ['profile', 'personal', 'data', 'information', 'edit'],
      },
      {
        id: 'measurements',
        titleKey: 'help.topics.my_profile.measurements.title',
        descKey: 'help.topics.my_profile.measurements.desc',
        steps: [
          'help.topics.my_profile.measurements.step1',
          'help.topics.my_profile.measurements.step2',
        ],
        tags: ['measurement', 'weight', 'height', 'bmi', 'record'],
      },
      {
        id: 'water_consumption',
        titleKey: 'help.topics.my_profile.water_consumption.title',
        descKey: 'help.topics.my_profile.water_consumption.desc',
        steps: [
          'help.topics.my_profile.water_consumption.step1',
          'help.topics.my_profile.water_consumption.step2',
        ],
        tags: ['water', 'hydration', 'intake', 'track', 'ml'],
      },
      {
        id: 'clinical_info',
        titleKey: 'help.topics.my_profile.clinical_info.title',
        descKey: 'help.topics.my_profile.clinical_info.desc',
        steps: [
          'help.topics.my_profile.clinical_info.step1',
          'help.topics.my_profile.clinical_info.step2',
        ],
        tags: ['clinical', 'health', 'allergies', 'habits', 'medical'],
      },
      {
        id: 'fixed_guidelines',
        titleKey: 'help.topics.my_profile.fixed_guidelines.title',
        descKey: 'help.topics.my_profile.fixed_guidelines.desc',
        tags: ['guideline', 'rule', 'instruction', 'protocol'],
      },
      {
        id: 'events',
        titleKey: 'help.topics.my_profile.events.title',
        descKey: 'help.topics.my_profile.events.desc',
        steps: [
          'help.topics.my_profile.events.step1',
          'help.topics.my_profile.events.step2',
        ],
        tags: ['event', 'timeline', 'activity', 'log'],
      },
      {
        id: 'my_appointments',
        titleKey: 'help.topics.my_profile.my_appointments.title',
        descKey: 'help.topics.my_profile.my_appointments.desc',
        tags: ['appointment', 'cita', 'session', 'visit', 'history'],
      },
    ],
  },

  {
    id: 'patient_settings',
    titleKey: 'help.sections.patient_settings',
    icon: 'fa-solid fa-sliders',
    roles: ['nutritionist', 'patient'],
    order: 140,
    topics: [
      {
        id: 'theme_preference',
        titleKey: 'help.topics.patient_settings.theme_preference.title',
        descKey: 'help.topics.patient_settings.theme_preference.desc',
        steps: [
          'help.topics.patient_settings.theme_preference.step1',
          'help.topics.patient_settings.theme_preference.step2',
        ],
        tags: ['theme', 'dark', 'light', 'mode', 'preference'],
      },
      {
        id: 'language_preference',
        titleKey: 'help.topics.patient_settings.language_preference.title',
        descKey: 'help.topics.patient_settings.language_preference.desc',
        steps: [
          'help.topics.patient_settings.language_preference.step1',
          'help.topics.patient_settings.language_preference.step2',
        ],
        tags: ['language', 'idioma', 'english', 'spanish'],
      },
      {
        id: 'notifications',
        titleKey: 'help.topics.patient_settings.notifications.title',
        descKey: 'help.topics.patient_settings.notifications.desc',
        steps: [
          'help.topics.patient_settings.notifications.step1',
          'help.topics.patient_settings.notifications.step2',
        ],
        tags: ['notifications', 'alert', 'email', 'push'],
      },
      {
        id: 'account_info',
        titleKey: 'help.topics.patient_settings.account_info.title',
        descKey: 'help.topics.patient_settings.account_info.desc',
        tags: ['account', 'email', 'password', 'security'],
      },
    ],
  },
];
