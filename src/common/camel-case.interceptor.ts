import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Readable } from 'stream';

function toCamelCaseKey(key: string): string {
  if (!key || key[0] === key[0].toLowerCase()) {
    return key;
  }

  return key[0].toLowerCase() + key.slice(1);
}

function esBinarioOStream(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  if (value instanceof Date || value instanceof StreamableFile) return true;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return true;
  if (value instanceof Readable || value instanceof Uint8Array) return true;
  const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
  if (ctor === 'StreamableFile' || ctor === 'File' || ctor === 'Blob') return true;
  const obj = value as { getStream?: unknown; pipe?: unknown; stream?: unknown };
  if (typeof obj.getStream === 'function' || typeof obj.pipe === 'function') {
    return true;
  }
  return false;
}

function toCamelCaseDeep(value: unknown): unknown {
  if (esBinarioOStream(value)) {
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

@Injectable()
export class CamelCaseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (esBinarioOStream(data)) return data;
        return toCamelCaseDeep(data);
      }),
    );
  }
}
