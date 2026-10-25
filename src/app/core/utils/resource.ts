import { Resource, Signal, computed } from '@angular/core';
import { errorMessage } from '../models';

/**
 * Valor de un `resource`/`rxResource` con un valor por defecto mientras carga
 * o si ha fallado (`resource.value()` lanza una excepción en estado de error).
 */
export function valueOr<T>(res: Resource<T | undefined>, fallback: T): Signal<T> {
  return computed(() => (res.hasValue() ? (res.value() as T) : fallback));
}

/** Mensaje de error de un resource (o cadena vacía). */
export function errorOf(res: Resource<unknown>): Signal<string> {
  return computed(() => (res.error() ? errorMessage(res.error()) : ''));
}
