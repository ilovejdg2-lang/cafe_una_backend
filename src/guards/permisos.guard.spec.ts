import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermisosGuard } from './permisos.guard';

function consultar(user: { roles?: string[]; role?: string | string[] }, permisos: string[]) {
  const reflector = {
    getAllAndOverride: () => permisos,
  } as unknown as Reflector;
  const guard = new PermisosGuard(reflector);
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  return guard.canActivate(context as never);
}

describe('PermisosGuard', () => {
  it('deja pasar a SuperAdmin solo si la matriz le da el permiso', () => {
    expect(consultar({ roles: ['SuperAdmin'] }, ['ver_documentacion_privada'])).toBe(true);
    expect(() => consultar({ roles: ['SuperAdmin'] }, ['comprar_productos'])).toThrow(
      ForbiddenException,
    );
  });

  it('no hereda inactivar documentación al rol Admin', () => {
    expect(consultar({ roles: ['Admin'] }, ['actualizar_documentacion'])).toBe(true);
    expect(() => consultar({ roles: ['Admin'] }, ['inactivar_documentacion'])).toThrow(
      ForbiddenException,
    );
  });

  it('niega ver todas las facturas a Cliente y a Vendedor sin ese permiso en la matriz', () => {
    expect(() => consultar({ role: 'Cliente' }, ['ver_todas_las_facturas'])).toThrow(
      ForbiddenException,
    );
    expect(consultar({ role: 'Vendedor' }, ['ver_todas_las_facturas'])).toBe(true);
    expect(() => consultar({ role: 'Vendedor' }, ['ver_documentacion_privada'])).toThrow(
      ForbiddenException,
    );
  });
});
