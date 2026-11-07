import { HttpContextToken } from '@angular/common/http';

/**
 * Tokens de contexto con los que una petición concreta se sale del tratamiento
 * global de errores.
 *
 * Viven aquí, y no en `error.interceptor.ts`, para que los servicios de API
 * puedan usarlos sin importar el interceptor: el interceptor de errores sí
 * necesita conocer servicios de API (p. ej. el estado de facturación), y el
 * ciclo de imports dejaría los tokens sin inicializar.
 */

/** Silencia el toast de 404 cuando la ausencia del recurso es un caso esperado. */
export const IGNORE_NOT_FOUND = new HttpContextToken<boolean>(() => false);

/**
 * Silencia el toast genérico de error para que quien llama presente su propia
 * UI (un error en línea, un diálogo de reintento…). Los efectos colaterales
 * —refresco de token en 401, redirecciones en 403— siguen aplicándose.
 */
export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);

/**
 * Desactiva la redirección global del 403. Pensado para funciones que tratan
 * sus propios 403 (p. ej. la mascota: «IA no habilitada», «falta
 * consentimiento») y no deben expulsar al usuario de la pantalla.
 */
export const IGNORE_FORBIDDEN = new HttpContextToken<boolean>(() => false);
