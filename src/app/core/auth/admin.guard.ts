import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.user();
  if (user) {
    const isAdmin = user.memberships.some(m => m.permissions.includes('MANAGE_TENANT')); // In a real app we'd also check if the tenant is adminTenant
    if (isAdmin) return true;
  }
  
  return router.createUrlTree(['/not-authorized']);
};
