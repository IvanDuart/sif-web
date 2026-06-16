import { HttpInterceptorFn } from '@angular/common/http';
import { signal } from '@angular/core';
import { finalize } from 'rxjs';

export const globalLoadingSignal = signal<number>(0);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  globalLoadingSignal.update(n => n + 1);
  return next(req).pipe(
    finalize(() => globalLoadingSignal.update(n => Math.max(0, n - 1)))
  );
};
