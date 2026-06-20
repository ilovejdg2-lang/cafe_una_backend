import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function toCamelCaseKey(key: string): string {
  if (!key || key[0] === key[0].toLowerCase()) {
    return key;
  }

  return key[0].toLowerCase() + key.slice(1);
}

function toCamelCaseDeep(value: unknown): unknown {
  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toCamelCaseDeep(item));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        toCamelCaseKey(key),
        toCamelCaseDeep(nested),
      ]),
    );
  }

  return value;
}

/** Igual que ASP.NET Core: respuestas JSON en camelCase para el frontend React. */
@Injectable()
export class CamelCaseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => toCamelCaseDeep(data)));
  }
}
