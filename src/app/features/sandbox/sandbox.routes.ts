import { Routes } from '@angular/router';

/**
 * Ruta del banco de pruebas visual. Sólo se incluye en desarrollo: en el build
 * de producción este archivo se sustituye por `sandbox.routes.prod.ts` (vacío)
 * vía `fileReplacements`, de modo que ni la ruta ni su bundle llegan a producción.
 */
export const sandboxRoutes: Routes = [
  {
    path: 'sandbox',
    loadComponent: () => import('./sandbox.component').then(m => m.SandboxComponent)
  }
];
