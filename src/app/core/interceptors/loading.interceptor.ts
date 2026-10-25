import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { UiStore } from '../state/ui.store';
import { SKIP_LOADING } from './http-context';

/**
 * **Interceptor de carga**: lleva la cuenta de peticiones en curso para mostrar
 * una barra de progreso global (`UiStore.busy`). `finalize` garantiza que el
 * contador se decrementa aunque la petición falle o se cancele.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_LOADING)) return next(req);
  const ui = inject(UiStore);
  ui.requestStarted();
  return next(req).pipe(finalize(() => ui.requestFinished()));
};
