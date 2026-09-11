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

function esBinarioOStream(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  if (value instanceof Date) return true;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return true;
  const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
  if (ctor === 'StreamableFile' || ctor === 'File' || ctor === 'Blob') return true;
  const obj = value as { pipe?: unknown; getStream?: unknown };
  return typeof obj.pipe === 'function' || typeof obj.getStream === 'function';
}

function enrichPascalKeys(value: unknown): unknown {
  if (esBinarioOStream(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => enrichPascalKeys(item));
  }

  if (value !== null && typeof value === 'object') {
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
