import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

function toPascalKey(key: string): string {
  if (!key) return key;
  return key[0].toUpperCase() + key.slice(1);
}

function enrichPascalKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => enrichPascalKeys(item));
  }

  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>);
    const out: Record<string, unknown> = {};

    for (const [key, nested] of entries) {
      const converted = enrichPascalKeys(nested);
      out[key] = converted;
      const pascal = toPascalKey(key);
      if (!(pascal in out)) {
        out[pascal] = converted;
      }
    }

    return out;
  }

  return value;
}

@Injectable()
export class PascalBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ body?: unknown }>();
    if (request?.body && typeof request.body === 'object') {
      request.body = enrichPascalKeys(request.body);
    }
    return next.handle();
  }
}
