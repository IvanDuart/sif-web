import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionsService } from './permissions.service';

export const permissionGuard: CanActivateFn = (route, state) => {
  const permissionsService = inject(PermissionsService);
  const router = inject(Router);

  const requiredPermission = route.data['permission'] as string;
  
  if (requiredPermission && !permissionsService.has(requiredPermission)) {
    return router.createUrlTree(['/not-authorized']);
  }
  
  return true;
};
