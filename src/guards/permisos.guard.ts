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
      user?: { roles?: string[]; role?: string };
    }>();
    const rawRoles = request.user?.roles ?? (request.user?.role ? [request.user.role] : []);
    const esSuperAdmin = rawRoles.some((r) =>
      ['superadmin', 'superadministrador'].includes(String(r).toLowerCase()),
    );
    if (esSuperAdmin) {
      return true;
    }

    if (tieneAlgunPermiso(rawRoles, permisos)) {
      return true;
    }

    throw new ForbiddenException('No tiene permiso para esta acción.');
  }
}
