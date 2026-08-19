import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISOS_KEY } from '../common/requiere-permiso.decorator';
import { tieneAlgunPermiso } from '../common/permisos';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisos = this.reflector.getAllAndOverride<string[]>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permisos || permisos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { roles?: string[] };
    }>();
    const roles = request.user?.roles ?? [];
    if (tieneAlgunPermiso(roles, permisos)) {
      return true;
    }

    throw new ForbiddenException('No tiene permiso para esta acción.');
  }
}
