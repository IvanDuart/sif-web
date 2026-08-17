#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Rebuild help section translations in es.json and en.json
 * Converts from flat structure to nested structure matching help-content.ts expectations
 */

const helpTranslationsEs = {
  'title': 'Centro de Ayuda',
  'subtitle': 'Guías detalladas para nutricionistas y pacientes',
  'search_placeholder': 'Buscar en la ayuda...',
  'content_region': 'Contenido de ayuda',
  'common': 'General',
  'nutritionist': 'Para Nutricionistas',
  'patient': 'Para Pacientes',
  'patient_for_nutri': 'Guía de Pacientes',
  'steps_label': 'Pasos',
  'screenshot_label': 'Capturas de pantalla',
  'go_to_app': 'Ir a la sección',
  'no_results_title': 'Sin resultados',
  'no_results_desc': 'No encontramos coincidencias para tu búsqueda. Intenta con otros términos.',
  'clear_search': 'Limpiar búsqueda',

  'sections': {
    'access': 'Acceso y Contraseña',
    'preferences': 'Preferencias',
    'shortcuts': 'Atajos',
    'dashboard_nutri': 'Panel Principal (Nutricionista)',
    'patients': 'Gestión de Pacientes',
    'patient_detail': 'Detalle del Paciente',
    'staff': 'Gestión del Equipo',
    'appointments': 'Citas y Calendario',
    'revenue': 'Ingresos y Análisis',
    'menus_templates': 'Menús y Plantillas',
    'settings': 'Configuración',
    'dashboard_patient': 'Panel Principal (Paciente)',
    'my_diets': 'Mis Dietas',
    'shopping_list': 'Lista de la Compra',
    'my_profile': 'Mi Perfil',
    'patient_settings': 'Configuración'
  },

  'topics': {
    'access': {
      'login': {
        'title': 'Iniciar Sesión',
        'desc': 'Aprende cómo acceder a la plataforma con tu email y contraseña',
        'step1': 'Abre la página de login',
        'step2': 'Ingresa tu email registrado',
        'step3': 'Ingresa tu contraseña'
      },
      'switch_tenant': {
        'title': 'Cambiar Entre Clínicas',
        'desc': 'Si tienes acceso a múltiples clínicas, aprende a cambiar entre ellas',
        'step1': 'Haz clic en el selector de clínica en la barra superior',
        'step2': 'Selecciona la clínica deseada',
        'step3': 'La aplicación se recargará con los datos de la nueva clínica'
      },
      'recover_password': {
        'title': 'Recuperar Contraseña',
        'desc': 'Restaura el acceso a tu cuenta si olvidaste tu contraseña',
        'step1': 'Haz clic en \'Olvidé mi contraseña\' en la página de login',
        'step2': 'Ingresa tu email registrado',
        'step3': 'Sigue las instrucciones en el email recibido'
      }
    },
    'preferences': {
      'theme': {
        'title': 'Cambiar Tema (Claro/Oscuro)',
        'desc': 'Personaliza el aspecto visual de la aplicación con modo claro u oscuro',
        'step1': 'Haz clic en el icono del tema en la barra superior',
        'step2': 'Selecciona claro u oscuro según tu preferencia'
      },
      'language': {
        'title': 'Cambiar Idioma',
        'desc': 'Selecciona el idioma de la interfaz (Español o Inglés)',
        'step1': 'Ve a Configuración desde el menú lateral',
        'step2': 'Selecciona tu idioma preferido'
      },
      'notifications': {
        'title': 'Gestionar Notificaciones',
        'desc': 'Configura cómo recibes notificaciones de la plataforma',
        'step1': 'Abre Configuración > Notificaciones',
        'step2': 'Activa o desactiva tipos de notificaciones según prefieras'
      }
    },
    'shortcuts': {
      'keyboard': {
        'title': 'Atajos de Teclado',
        'desc': 'Aprende los atajos de teclado para navegar más rápidamente',
        'step1': 'Presiona Ctrl+K para abrir búsqueda rápida',
        'step2': 'Escribe para buscar funciones o páginas',
        'step3': 'Presiona Enter para ir a la sección'
      },
      'search': {
        'title': 'Búsqueda Global',
        'desc': 'Usa la búsqueda global para encontrar pacientes, citas y más',
        'step1': 'Presiona Ctrl+K desde cualquier página',
        'step2': 'Comienza a escribir lo que buscas'
      },
      'breadcrumbs': {
        'title': 'Navegación por Migas de Pan',
        'desc': 'Usa el rastro de navegación para volver a secciones anteriores',
        'step1': 'Observa el rastro de navegación en la parte superior'
      }
    },
    'dashboard_nutri': {
      'overview': {
        'title': 'Visión General del Panel',
        'desc': 'Conoce los elementos principales del panel de control'
      },
      'widgets': {
        'title': 'Widgets y Tarjetas',
        'desc': 'Entiende cada widget del panel de control',
        'step1': 'Observa los widgets con métricas clave',
        'step2': 'Haz clic en un widget para profundizar en los datos'
      },
      'quick_actions': {
        'title': 'Acciones Rápidas',
        'desc': 'Usa los botones rápidos para tareas comunes',
        'step1': 'Observa los botones en el panel',
        'step2': 'Haz clic para crear citas, pacientes, menús, etc'
      },
      'appointments_proposed': {
        'title': 'Propuestas de Citas',
        'desc': 'Revisa las propuestas automáticas de citas del sistema',
        'step1': 'Ve a la campana de notificaciones',
        'step2': 'Revisa propuestas de citas sugeridas por el sistema'
      }
    },
    'patients': {
      'list_view': {
        'title': 'Lista de Pacientes',
        'desc': 'Accede y gestiona todos tus pacientes'
      },
      'search_filter': {
        'title': 'Buscar y Filtrar Pacientes',
        'desc': 'Encuentra rápidamente pacientes usando búsqueda y filtros',
        'step1': 'Usa el campo de búsqueda para buscar por nombre o email',
        'step2': 'Aplica filtros por estado, fecha de registro, etc'
      },
      'invite_patient': {
        'title': 'Invitar Nuevo Paciente',
        'desc': 'Invita nuevos pacientes a la plataforma',
        'step1': 'Haz clic en \'Invitar Paciente\' en la lista',
        'step2': 'Ingresa el email del paciente',
        'step3': 'El paciente recibirá una invitación por email'
      },
      'edit_patient': {
        'title': 'Editar Datos del Paciente',
        'desc': 'Actualiza la información personal de un paciente',
        'step1': 'Abre la ficha del paciente',
        'step2': 'Haz clic en \'Editar\' en la pestaña Perfil',
        'step3': 'Actualiza los datos y guarda'
      },
      'activate_deactivate': {
        'title': 'Activar/Desactivar Paciente',
        'desc': 'Cambia el estado activo/inactivo de un paciente',
        'step1': 'Abre la ficha del paciente',
        'step2': 'Haz clic en \'Desactivar\' o \'Activar\' según sea necesario'
      },
      'view_details': {
        'title': 'Ver Detalle del Paciente',
        'desc': 'Accede a toda la información del paciente',
        'step1': 'Desde la lista, haz clic en el paciente',
        'step2': 'Se abre la ficha completa del paciente'
      }
    },
    'patient_detail': {
      'profile_tab': {
        'title': 'Pestaña Perfil',
        'desc': 'Datos personales y de contacto del paciente'
      },
      'measurements_tab': {
        'title': 'Pestaña Mediciones',
        'desc': 'Registra y visualiza mediciones corporales del paciente',
        'step1': 'Ve a la pestaña \'Mediciones\'',
        'step2': 'Haz clic en \'Registrar Medición\' para agregar nuevos datos'
      },
      'menus_assigned': {
        'title': 'Menús Asignados',
        'desc': 'Ve y gestiona menús asignados al paciente',
        'step1': 'Abre la pestaña \'Menús\'',
        'step2': 'Visualiza menús activos e histórico'
      },
      'water_tab': {
        'title': 'Consumo de Agua',
        'desc': 'Monitorea el consumo de agua del paciente'
      },
      'clinical_profile': {
        'title': 'Perfil Clínico',
        'desc': 'Datos médicos, alergias y hábitos del paciente',
        'step1': 'Ve a la pestaña \'Perfil Médico\'',
        'step2': 'Visualiza información clínica completa'
      },
      'fixed_guidelines': {
        'title': 'Pautas Fijas',
        'desc': 'Directrices nutricionales específicas para este paciente'
      },
      'events_tab': {
        'title': 'Eventos',
        'desc': 'Visualiza el historial de eventos y cambios del paciente',
        'step1': 'Abre la pestaña \'Eventos\'',
        'step2': 'Revisa el timeline de actividades'
      },
      'appointments_history': {
        'title': 'Historial de Citas',
        'desc': 'Visualiza todas las citas pasadas y próximas'
      }
    },
    'staff': {
      'list_view': {
        'title': 'Lista del Equipo',
        'desc': 'Visualiza todos los miembros del equipo'
      },
      'invite_staff': {
        'title': 'Invitar Miembro del Equipo',
        'desc': 'Añade nuevos nutricionistas o personal administrativo',
        'step1': 'Haz clic en \'Invitar Miembro\'',
        'step2': 'Ingresa el email y selecciona el rol',
        'step3': 'El usuario recibirá invitación por email'
      },
      'edit_roles': {
        'title': 'Editar Roles y Permisos',
        'desc': 'Modifica los roles y permisos de un miembro del equipo',
        'step1': 'Abre la ficha del miembro',
        'step2': 'Edita rol y permisos específicos'
      },
      'remove_staff': {
        'title': 'Remover Miembro del Equipo',
        'desc': 'Revoca el acceso a un miembro del equipo',
        'step1': 'Abre la ficha del miembro',
        'step2': 'Haz clic en \'Revocar acceso\''
      }
    },
    'appointments': {
      'calendar_view': {
        'title': 'Calendario de Citas',
        'desc': 'Visualiza y gestiona citas en el calendario'
      },
      'create_appointment': {
        'title': 'Crear Nueva Cita',
        'desc': 'Agenda una cita con un paciente',
        'step1': 'Haz clic en \'Nueva Cita\' o en una fecha del calendario',
        'step2': 'Selecciona el paciente y tipo de cita',
        'step3': 'Elige fecha, hora y duración'
      },
      'attend_appointment': {
        'title': 'Marcar Cita como Asistida',
        'desc': 'Registra que un paciente asistió a su cita',
        'step1': 'Abre la cita en el calendario',
        'step2': 'Haz clic en \'Marcar como Asistida\''
      },
      'cancel_appointment': {
        'title': 'Cancelar Cita',
        'desc': 'Cancela una cita programada',
        'step1': 'Abre la cita',
        'step2': 'Haz clic en \'Cancelar Cita\''
      },
      'no_show': {
        'title': 'Registrar No Show',
        'desc': 'Marca una cita como no asistida',
        'step1': 'Abre la cita',
        'step2': 'Marca como \'No Asistió\''
      },
      'proposed_appointments': {
        'title': 'Propuestas de Citas',
        'desc': 'Revisa y aprueba propuestas automáticas del sistema',
        'step1': 'Ve a la sección de propuestas',
        'step2': 'Revisa y aprueba o rechaza sugerencias'
      }
    },
    'revenue': {
      'overview': {
        'title': 'Visión General de Ingresos',
        'desc': 'Visualiza tus ingresos totales y tendencias'
      },
      'charts_metrics': {
        'title': 'Gráficos y Métricas',
        'desc': 'Analiza ingresos con gráficos detallados',
        'step1': 'Observa el gráfico principal de ingresos',
        'step2': 'Interpreta las métricas mostradas'
      },
      'time_granularity': {
        'title': 'Agrupar por Período',
        'desc': 'Visualiza ingresos por día, semana o mes',
        'step1': 'Selecciona granularidad (día, semana, mes)',
        'step2': 'El gráfico se actualiza automáticamente'
      },
      'filter_by_staff': {
        'title': 'Filtrar por Nutricionista',
        'desc': 'Visualiza ingresos de nutricionistas específicos',
        'step1': 'Selecciona un nutricionista en el filtro',
        'step2': 'Se muestran solo sus ingresos'
      }
    },
    'menus_templates': {
      'menus_list': {
        'title': 'Lista de Menús',
        'desc': 'Visualiza todos los menús creados'
      },
      'create_manual_menu': {
        'title': 'Crear Menú Manualmente',
        'desc': 'Diseña un menú personalizado desde cero',
        'step1': 'Haz clic en \'Crear Menú\'',
        'step2': 'Selecciona duración y macros objetivo',
        'step3': 'Añade platos día a día'
      },
      'upload_ai_menu': {
        'title': 'Cargar Menú con IA',
        'desc': 'Sube una imagen/PDF y la IA crea el menú automáticamente',
        'step1': 'Haz clic en \'Importar\'',
        'step2': 'Sube un PDF o imagen de dieta',
        'step3': 'La IA procesa y crea el menú'
      },
      'edit_meals': {
        'title': 'Editar Platos',
        'desc': 'Modifica platos de un menú',
        'step1': 'Abre el menú en detalle',
        'step2': 'Haz clic en un plato para editar'
      },
      'assign_menu': {
        'title': 'Asignar Menú a Paciente',
        'desc': 'Vincula un menú a un paciente',
        'step1': 'En el menú, haz clic en \'Asignar a Paciente\'',
        'step2': 'Selecciona el paciente y fecha de inicio'
      },
      'templates_list': {
        'title': 'Lista de Plantillas',
        'desc': 'Visualiza plantillas reutilizables'
      },
      'create_template': {
        'title': 'Crear Plantilla',
        'desc': 'Diseña una plantilla reutilizable',
        'step1': 'Haz clic en \'Crear Plantilla\'',
        'step2': 'Diseña la plantilla con platos reusables'
      },
      'instantiate_template': {
        'title': 'Usar Plantilla',
        'desc': 'Crea un menú basado en una plantilla',
        'step1': 'Selecciona una plantilla',
        'step2': 'Haz clic en \'Usar Plantilla\' para crear menú'
      }
    },
    'settings': {
      'branding': {
        'title': 'Personalización de Marca',
        'desc': 'Configura logo y colores de tu clínica',
        'step1': 'Ve a Configuración > Personalización',
        'step2': 'Sube logo y elige color principal'
      },
      'appointment_types': {
        'title': 'Tipos de Cita',
        'desc': 'Define tipos de citas y duración',
        'step1': 'Ve a Configuración > Tipos de Cita',
        'step2': 'Crea o edita tipos personalizados'
      },
      'anamnesis': {
        'title': 'Campos de Anamnesis',
        'desc': 'Selecciona campos médicos para perfiles de pacientes',
        'step1': 'Ve a Configuración > Anamnesis',
        'step2': 'Activa/desactiva campos según necesidad'
      },
      'schedule': {
        'title': 'Horario de Trabajo',
        'desc': 'Define horarios y jornadas de tu clínica',
        'step1': 'Ve a Configuración > Horarios',
        'step2': 'Define bloques de trabajo por día'
      },
      'clinic_address': {
        'title': 'Dirección de la Clínica',
        'desc': 'Actualiza ubicación y datos de contacto',
        'step1': 'Ve a Configuración > Dirección',
        'step2': 'Ingresa dirección completa'
      }
    },
    'dashboard_patient': {
      'overview': {
        'title': 'Mi Panel de Control',
        'desc': 'Visualiza tu información de salud consolidada'
      },
      'water_tracking': {
        'title': 'Seguimiento de Agua',
        'desc': 'Registra tu consumo diario de agua',
        'step1': 'En el panel, visualiza el widget de agua',
        'step2': 'Haz clic para registrar consumo'
      },
      'upcoming_appointment': {
        'title': 'Próxima Cita',
        'desc': 'Visualiza tu siguiente cita agendada'
      },
      'todays_meals': {
        'title': 'Comidas de Hoy',
        'desc': 'Ve qué está planificado comer hoy'
      },
      'weight_graph': {
        'title': 'Gráfico de Peso',
        'desc': 'Visualiza la evolución de tu peso'
      },
      'shopping_list_widget': {
        'title': 'Widget Lista de Compra',
        'desc': 'Acceso rápido a tu lista de compra'
      }
    },
    'my_diets': {
      'view_menus': {
        'title': 'Mis Dietas',
        'desc': 'Visualiza todos los menús asignados'
      },
      'weekly_detail': {
        'title': 'Detalle Semanal',
        'desc': 'Ve en detalle las comidas de cada día',
        'step1': 'Abre un menú asignado',
        'step2': 'Visualiza día a día las comidas'
      },
      'download_pdf': {
        'title': 'Descargar PDF',
        'desc': 'Descarga tu menú en formato PDF',
        'step1': 'En un menú, haz clic en \'Descargar PDF\'',
        'step2': 'Se descarga el archivo para imprimir'
      },
      'meal_details': {
        'title': 'Detalles de Comidas',
        'desc': 'Ve información nutricional de cada plato',
        'step1': 'Haz clic en una comida',
        'step2': 'Visualiza ingredientes y macros'
      }
    },
    'shopping_list': {
      'view_list': {
        'title': 'Mi Lista de Compra',
        'desc': 'Visualiza tu lista de compras'
      },
      'grouped_by_store': {
        'title': 'Agrupar por Supermercado',
        'desc': 'Organiza items por tienda',
        'step1': 'Selecciona opción de agrupar',
        'step2': 'Los items se reorganizan por supermercado'
      },
      'mark_purchased': {
        'title': 'Marcar como Comprado',
        'desc': 'Marca items mientras compras',
        'step1': 'Haz clic en un item',
        'step2': 'Marca como \'Comprado\''
      },
      'share_list': {
        'title': 'Compartir Lista',
        'desc': 'Comparte tu lista con otro usuario',
        'step1': 'Haz clic en \'Compartir\'',
        'step2': 'Ingresa email del destinatario'
      }
    },
    'my_profile': {
      'personal_data': {
        'title': 'Datos Personales',
        'desc': 'Ve y edita tu información personal'
      },
      'measurements': {
        'title': 'Mis Mediciones',
        'desc': 'Registra tu peso, altura y otras medidas',
        'step1': 'Ve a \'Mediciones\'',
        'step2': 'Haz clic en \'Registrar Medición\''
      },
      'water_consumption': {
        'title': 'Consumo de Agua',
        'desc': 'Registra tu consumo diario de agua',
        'step1': 'Ve a \'Mi Consumo de Agua\'',
        'step2': 'Registra ml consumidos'
      },
      'clinical_info': {
        'title': 'Información Clínica',
        'desc': 'Datos médicos, alergias y antecedentes',
        'step1': 'Ve a \'Información Clínica\'',
        'step2': 'Completa información médica personal'
      },
      'fixed_guidelines': {
        'title': 'Mis Pautas',
        'desc': 'Directrices personales nutricionales'
      },
      'events': {
        'title': 'Mi Timeline',
        'desc': 'Visualiza evento de tu historial',
        'step1': 'Ve a \'Eventos\'',
        'step2': 'Revisa cambios y actividad'
      },
      'my_appointments': {
        'title': 'Mis Citas',
        'desc': 'Visualiza todas tus citas'
      }
    },
    'patient_settings': {
      'theme_preference': {
        'title': 'Preferencia de Tema',
        'desc': 'Elige entre modo claro u oscuro',
        'step1': 'Ve a Configuración > Tema',
        'step2': 'Selecciona tu preferencia'
      },
      'language_preference': {
        'title': 'Idioma',
        'desc': 'Selecciona tu idioma preferido',
        'step1': 'Ve a Configuración > Idioma',
        'step2': 'Elige Español o Inglés'
      },
      'notifications': {
        'title': 'Notificaciones',
        'desc': 'Configura cómo recibes notificaciones',
        'step1': 'Ve a Configuración > Notificaciones',
        'step2': 'Activa/desactiva notificaciones'
      },
      'account_info': {
        'title': 'Información de Cuenta',
        'desc': 'Ve y cambia datos de tu cuenta'
      }
    }
  }
};

const helpTranslationsEn = {
  'title': 'Help Center',
  'subtitle': 'Detailed guides for nutritionists and patients',
  'search_placeholder': 'Search help...',
  'content_region': 'Help content',
  'common': 'General',
  'nutritionist': 'For Nutritionists',
  'patient': 'For Patients',
  'patient_for_nutri': 'Patient Guide',
  'steps_label': 'Steps',
  'screenshot_label': 'Screenshots',
  'go_to_app': 'Go to section',
  'no_results_title': 'No results',
  'no_results_desc': 'We couldn\'t find matches for your search. Try different terms.',
  'clear_search': 'Clear search',

  'sections': {
    'access': 'Access & Password',
    'preferences': 'Preferences',
    'shortcuts': 'Shortcuts',
    'dashboard_nutri': 'Main Dashboard (Nutritionist)',
    'patients': 'Patient Management',
    'patient_detail': 'Patient Details',
    'staff': 'Team Management',
    'appointments': 'Appointments & Calendar',
    'revenue': 'Revenue & Analytics',
    'menus_templates': 'Menus & Templates',
    'settings': 'Settings',
    'dashboard_patient': 'Main Dashboard (Patient)',
    'my_diets': 'My Diets',
    'shopping_list': 'Shopping List',
    'my_profile': 'My Profile',
    'patient_settings': 'Settings'
  },

  'topics': {
    'access': {
      'login': {
        'title': 'Log In',
        'desc': 'Learn how to access the platform with your email and password',
        'step1': 'Open the login page',
        'step2': 'Enter your registered email',
        'step3': 'Enter your password'
      },
      'switch_tenant': {
        'title': 'Switch Between Clinics',
        'desc': 'If you have access to multiple clinics, learn how to switch between them',
        'step1': 'Click on the clinic selector in the top bar',
        'step2': 'Select the desired clinic',
        'step3': 'The application will reload with the new clinic\'s data'
      },
      'recover_password': {
        'title': 'Recover Password',
        'desc': 'Restore access to your account if you forgot your password',
        'step1': 'Click on \'Forgot my password\' on the login page',
        'step2': 'Enter your registered email',
        'step3': 'Follow the instructions in the email received'
      }
    },
    'preferences': {
      'theme': {
        'title': 'Change Theme (Light/Dark)',
        'desc': 'Customize the visual appearance of the application with light or dark mode',
        'step1': 'Click on the theme icon in the top bar',
        'step2': 'Select light or dark according to your preference'
      },
      'language': {
        'title': 'Change Language',
        'desc': 'Select the interface language (Spanish or English)',
        'step1': 'Go to Settings from the sidebar menu',
        'step2': 'Select your preferred language'
      },
      'notifications': {
        'title': 'Manage Notifications',
        'desc': 'Configure how you receive platform notifications',
        'step1': 'Open Settings > Notifications',
        'step2': 'Enable or disable notification types as you prefer'
      }
    },
    'shortcuts': {
      'keyboard': {
        'title': 'Keyboard Shortcuts',
        'desc': 'Learn keyboard shortcuts to navigate faster',
        'step1': 'Press Ctrl+K to open quick search',
        'step2': 'Type to search functions or pages',
        'step3': 'Press Enter to go to the section'
      },
      'search': {
        'title': 'Global Search',
        'desc': 'Use global search to find patients, appointments, and more',
        'step1': 'Press Ctrl+K from any page',
        'step2': 'Start typing what you\'re looking for'
      },
      'breadcrumbs': {
        'title': 'Breadcrumb Navigation',
        'desc': 'Use the navigation trail to go back to previous sections',
        'step1': 'Observe the navigation trail at the top'
      }
    },
    'dashboard_nutri': {
      'overview': {
        'title': 'Dashboard Overview',
        'desc': 'Get to know the main elements of the control panel'
      },
      'widgets': {
        'title': 'Widgets & Cards',
        'desc': 'Understand each dashboard widget',
        'step1': 'Observe the widgets with key metrics',
        'step2': 'Click on a widget to dive deeper into the data'
      },
      'quick_actions': {
        'title': 'Quick Actions',
        'desc': 'Use quick buttons for common tasks',
        'step1': 'Observe the buttons in the dashboard',
        'step2': 'Click to create appointments, patients, menus, etc'
      },
      'appointments_proposed': {
        'title': 'Appointment Proposals',
        'desc': 'Review automatic appointment proposals from the system',
        'step1': 'Go to the notification bell',
        'step2': 'Review appointment proposals suggested by the system'
      }
    },
    'patients': {
      'list_view': {
        'title': 'Patient List',
        'desc': 'Access and manage all your patients'
      },
      'search_filter': {
        'title': 'Search & Filter Patients',
        'desc': 'Quickly find patients using search and filters',
        'step1': 'Use the search field to search by name or email',
        'step2': 'Apply filters by status, registration date, etc'
      },
      'invite_patient': {
        'title': 'Invite New Patient',
        'desc': 'Invite new patients to the platform',
        'step1': 'Click on \'Invite Patient\' in the list',
        'step2': 'Enter the patient\'s email',
        'step3': 'The patient will receive an invitation email'
      },
      'edit_patient': {
        'title': 'Edit Patient Data',
        'desc': 'Update a patient\'s personal information',
        'step1': 'Open the patient\'s file',
        'step2': 'Click \'Edit\' in the Profile tab',
        'step3': 'Update the data and save'
      },
      'activate_deactivate': {
        'title': 'Activate/Deactivate Patient',
        'desc': 'Change a patient\'s active/inactive status',
        'step1': 'Open the patient\'s file',
        'step2': 'Click \'Deactivate\' or \'Activate\' as needed'
      },
      'view_details': {
        'title': 'View Patient Details',
        'desc': 'Access all patient information',
        'step1': 'From the list, click on the patient',
        'step2': 'The complete patient file opens'
      }
    },
    'patient_detail': {
      'profile_tab': {
        'title': 'Profile Tab',
        'desc': 'Patient\'s personal and contact data'
      },
      'measurements_tab': {
        'title': 'Measurements Tab',
        'desc': 'Record and view patient\'s body measurements',
        'step1': 'Go to the \'Measurements\' tab',
        'step2': 'Click \'Record Measurement\' to add new data'
      },
      'menus_assigned': {
        'title': 'Assigned Menus',
        'desc': 'View and manage menus assigned to the patient',
        'step1': 'Open the \'Menus\' tab',
        'step2': 'View active menus and history'
      },
      'water_tab': {
        'title': 'Water Consumption',
        'desc': 'Monitor the patient\'s water consumption'
      },
      'clinical_profile': {
        'title': 'Clinical Profile',
        'desc': 'Medical data, allergies, and habits',
        'step1': 'Go to the \'Medical Profile\' tab',
        'step2': 'View complete clinical information'
      },
      'fixed_guidelines': {
        'title': 'Fixed Guidelines',
        'desc': 'Specific nutritional guidelines for this patient'
      },
      'events_tab': {
        'title': 'Events',
        'desc': 'View patient\'s event history and changes',
        'step1': 'Open the \'Events\' tab',
        'step2': 'Review the activity timeline'
      },
      'appointments_history': {
        'title': 'Appointment History',
        'desc': 'View all past and upcoming appointments'
      }
    },
    'staff': {
      'list_view': {
        'title': 'Team List',
        'desc': 'View all team members'
      },
      'invite_staff': {
        'title': 'Invite Team Member',
        'desc': 'Add new nutritionists or administrative staff',
        'step1': 'Click on \'Invite Member\'',
        'step2': 'Enter the email and select a role',
        'step3': 'The user will receive an invitation email'
      },
      'edit_roles': {
        'title': 'Edit Roles & Permissions',
        'desc': 'Modify a team member\'s roles and permissions',
        'step1': 'Open the member\'s file',
        'step2': 'Edit role and specific permissions'
      },
      'remove_staff': {
        'title': 'Remove Team Member',
        'desc': 'Revoke access for a team member',
        'step1': 'Open the member\'s file',
        'step2': 'Click on \'Revoke access\''
      }
    },
    'appointments': {
      'calendar_view': {
        'title': 'Appointment Calendar',
        'desc': 'View and manage appointments on the calendar'
      },
      'create_appointment': {
        'title': 'Create New Appointment',
        'desc': 'Schedule an appointment with a patient',
        'step1': 'Click \'New Appointment\' or on a calendar date',
        'step2': 'Select the patient and appointment type',
        'step3': 'Choose date, time, and duration'
      },
      'attend_appointment': {
        'title': 'Mark Appointment as Attended',
        'desc': 'Record that a patient attended their appointment',
        'step1': 'Open the appointment on the calendar',
        'step2': 'Click \'Mark as Attended\''
      },
      'cancel_appointment': {
        'title': 'Cancel Appointment',
        'desc': 'Cancel a scheduled appointment',
        'step1': 'Open the appointment',
        'step2': 'Click \'Cancel Appointment\''
      },
      'no_show': {
        'title': 'Register No Show',
        'desc': 'Mark an appointment as not attended',
        'step1': 'Open the appointment',
        'step2': 'Mark as \'No Show\''
      },
      'proposed_appointments': {
        'title': 'Appointment Proposals',
        'desc': 'Review and approve automatic system proposals',
        'step1': 'Go to the proposals section',
        'step2': 'Review and approve or reject suggestions'
      }
    },
    'revenue': {
      'overview': {
        'title': 'Revenue Overview',
        'desc': 'View your total revenue and trends'
      },
      'charts_metrics': {
        'title': 'Charts & Metrics',
        'desc': 'Analyze revenue with detailed charts',
        'step1': 'Observe the main revenue chart',
        'step2': 'Interpret the displayed metrics'
      },
      'time_granularity': {
        'title': 'Group by Period',
        'desc': 'View revenue by day, week, or month',
        'step1': 'Select granularity (day, week, month)',
        'step2': 'The chart updates automatically'
      },
      'filter_by_staff': {
        'title': 'Filter by Nutritionist',
        'desc': 'View revenue from specific nutritionists',
        'step1': 'Select a nutritionist in the filter',
        'step2': 'Only their revenue is shown'
      }
    },
    'menus_templates': {
      'menus_list': {
        'title': 'Menu List',
        'desc': 'View all created menus'
      },
      'create_manual_menu': {
        'title': 'Create Menu Manually',
        'desc': 'Design a custom menu from scratch',
        'step1': 'Click \'Create Menu\'',
        'step2': 'Select duration and target macros',
        'step3': 'Add meals day by day'
      },
      'upload_ai_menu': {
        'title': 'Upload Menu with AI',
        'desc': 'Upload an image/PDF and AI will create the menu automatically',
        'step1': 'Click \'Import\'',
        'step2': 'Upload a PDF or diet image',
        'step3': 'AI processes and creates the menu'
      },
      'edit_meals': {
        'title': 'Edit Meals',
        'desc': 'Modify meals in a menu',
        'step1': 'Open the menu in detail',
        'step2': 'Click on a meal to edit'
      },
      'assign_menu': {
        'title': 'Assign Menu to Patient',
        'desc': 'Link a menu to a patient',
        'step1': 'In the menu, click \'Assign to Patient\'',
        'step2': 'Select the patient and start date'
      },
      'templates_list': {
        'title': 'Template List',
        'desc': 'View reusable templates'
      },
      'create_template': {
        'title': 'Create Template',
        'desc': 'Design a reusable template',
        'step1': 'Click \'Create Template\'',
        'step2': 'Design the template with reusable meals'
      },
      'instantiate_template': {
        'title': 'Use Template',
        'desc': 'Create a menu based on a template',
        'step1': 'Select a template',
        'step2': 'Click \'Use Template\' to create menu'
      }
    },
    'settings': {
      'branding': {
        'title': 'Brand Customization',
        'desc': 'Configure your clinic\'s logo and colors',
        'step1': 'Go to Settings > Customization',
        'step2': 'Upload logo and choose primary color'
      },
      'appointment_types': {
        'title': 'Appointment Types',
        'desc': 'Define appointment types and duration',
        'step1': 'Go to Settings > Appointment Types',
        'step2': 'Create or edit custom types'
      },
      'anamnesis': {
        'title': 'Anamnesis Fields',
        'desc': 'Select medical fields for patient profiles',
        'step1': 'Go to Settings > Anamnesis',
        'step2': 'Enable/disable fields as needed'
      },
      'schedule': {
        'title': 'Work Schedule',
        'desc': 'Define your clinic\'s schedules and working days',
        'step1': 'Go to Settings > Schedules',
        'step2': 'Define work blocks per day'
      },
      'clinic_address': {
        'title': 'Clinic Address',
        'desc': 'Update location and contact details',
        'step1': 'Go to Settings > Address',
        'step2': 'Enter complete address'
      }
    },
    'dashboard_patient': {
      'overview': {
        'title': 'My Dashboard',
        'desc': 'View your consolidated health information'
      },
      'water_tracking': {
        'title': 'Water Tracking',
        'desc': 'Record your daily water consumption',
        'step1': 'In the dashboard, view the water widget',
        'step2': 'Click to record consumption'
      },
      'upcoming_appointment': {
        'title': 'Upcoming Appointment',
        'desc': 'View your next scheduled appointment'
      },
      'todays_meals': {
        'title': 'Today\'s Meals',
        'desc': 'See what\'s planned to eat today'
      },
      'weight_graph': {
        'title': 'Weight Chart',
        'desc': 'View your weight evolution'
      },
      'shopping_list_widget': {
        'title': 'Shopping List Widget',
        'desc': 'Quick access to your shopping list'
      }
    },
    'my_diets': {
      'view_menus': {
        'title': 'My Diets',
        'desc': 'View all assigned menus'
      },
      'weekly_detail': {
        'title': 'Weekly Detail',
        'desc': 'See meals for each day in detail',
        'step1': 'Open an assigned menu',
        'step2': 'View meals day by day'
      },
      'download_pdf': {
        'title': 'Download PDF',
        'desc': 'Download your menu in PDF format',
        'step1': 'In a menu, click \'Download PDF\'',
        'step2': 'The file downloads for printing'
      },
      'meal_details': {
        'title': 'Meal Details',
        'desc': 'View nutritional information for each meal',
        'step1': 'Click on a meal',
        'step2': 'View ingredients and macros'
      }
    },
    'shopping_list': {
      'view_list': {
        'title': 'My Shopping List',
        'desc': 'View your shopping list'
      },
      'grouped_by_store': {
        'title': 'Group by Supermarket',
        'desc': 'Organize items by store',
        'step1': 'Select the group option',
        'step2': 'Items are reorganized by supermarket'
      },
      'mark_purchased': {
        'title': 'Mark as Purchased',
        'desc': 'Mark items as you shop',
        'step1': 'Click on an item',
        'step2': 'Mark as \'Purchased\''
      },
      'share_list': {
        'title': 'Share List',
        'desc': 'Share your list with another user',
        'step1': 'Click \'Share\'',
        'step2': 'Enter recipient\'s email'
      }
    },
    'my_profile': {
      'personal_data': {
        'title': 'Personal Data',
        'desc': 'View and edit your personal information'
      },
      'measurements': {
        'title': 'My Measurements',
        'desc': 'Record your weight, height, and other measurements',
        'step1': 'Go to \'Measurements\'',
        'step2': 'Click \'Record Measurement\''
      },
      'water_consumption': {
        'title': 'Water Consumption',
        'desc': 'Record your daily water intake',
        'step1': 'Go to \'My Water Consumption\'',
        'step2': 'Record ml consumed'
      },
      'clinical_info': {
        'title': 'Clinical Information',
        'desc': 'Medical data, allergies, and history',
        'step1': 'Go to \'Clinical Information\'',
        'step2': 'Complete your medical information'
      },
      'fixed_guidelines': {
        'title': 'My Guidelines',
        'desc': 'Your personal nutritional guidelines'
      },
      'events': {
        'title': 'My Timeline',
        'desc': 'View your history events',
        'step1': 'Go to \'Events\'',
        'step2': 'Review changes and activity'
      },
      'my_appointments': {
        'title': 'My Appointments',
        'desc': 'View all your appointments'
      }
    },
    'patient_settings': {
      'theme_preference': {
        'title': 'Theme Preference',
        'desc': 'Choose between light or dark mode',
        'step1': 'Go to Settings > Theme',
        'step2': 'Select your preference'
      },
      'language_preference': {
        'title': 'Language',
        'desc': 'Select your preferred language',
        'step1': 'Go to Settings > Language',
        'step2': 'Choose Spanish or English'
      },
      'notifications': {
        'title': 'Notifications',
        'desc': 'Configure how you receive notifications',
        'step1': 'Go to Settings > Notifications',
        'step2': 'Enable/disable notifications'
      },
      'account_info': {
        'title': 'Account Information',
        'desc': 'View and change your account data'
      }
    }
  }
};

/**
 * Update JSON file with new help section
 */
function updateJsonFile(filePath, helpTranslations) {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.help = helpTranslations;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
    return true;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
const esPath = path.join(__dirname, '..', 'src', 'assets', 'i18n', 'es.json');
const enPath = path.join(__dirname, '..', 'src', 'assets', 'i18n', 'en.json');

const esUpdated = updateJsonFile(esPath, helpTranslationsEs);
const enUpdated = updateJsonFile(enPath, helpTranslationsEn);

if (esUpdated && enUpdated) {
  console.log('✅ Successfully rebuilt help translations');
  console.log(`   - Updated ${esPath}`);
  console.log(`   - Updated ${enPath}`);
  console.log(`   - Total sections: 16`);
  console.log(`   - Total topics: 62`);
  console.log(`   - Structure: Nested (help.sections.{id}, help.topics.{sectionId}.{topicId}.{field})`);
  process.exit(0);
} else {
  console.error('❌ Failed to rebuild help translations');
  process.exit(1);
}
