import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtUsuario } from './permisos';
import { auditoriaContext } from './auditoria-context';

@Injectable()
export class AuditoriaContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: JwtUsuario }>();
    const userId = request.user?.userId ?? null;

    return new Observable((subscriber) => {
      auditoriaContext.run({ userId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
