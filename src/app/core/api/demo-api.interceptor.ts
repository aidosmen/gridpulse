import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { DemoBackend } from './demo-backend';

export const demoApiInterceptor: HttpInterceptorFn = (request, next) => {
  const path = new URL(request.url, 'http://gridpulse.local').pathname;
  if (!path.startsWith('/api/')) {
    return next(request);
  }
  return inject(DemoBackend).handle(request);
};
