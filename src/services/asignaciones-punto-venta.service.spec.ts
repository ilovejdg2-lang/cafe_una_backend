import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PERMISOS_SEED } from '../common/permisos-seed';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Usuario } from '../entities/usuario.entity';
import { VendedorPuntoVenta } from '../entities/vendedor-punto-venta.entity';
import {
  AsignacionesPuntoVentaService,
  MENSAJE_SIN_ASIGNACION,
} from './asignaciones-punto-venta.service';

function repo<T extends { Id?: number }>(rows: T[]) {
  const coincide = (row: T, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
  return {
    find: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
      rows.filter((row) => coincide(row, where)),
    ),
    findOne: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
      rows.find((row) => coincide(row, where)) ?? null,
    ),
    create: jest.fn((row: T) => row),
    save: jest.fn(async (row: T) => {
      if (!row.Id) row.Id = rows.length + 1;
      const index = rows.findIndex((actual) => actual.Id === row.Id);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
      return row;
    }),
    manager: { transaction: jest.fn() },
  };
}

function repoAsignaciones(rows: VendedorPuntoVenta[], catalogo: InventarioUbicacion[]) {
  const base = repo(rows);
  base.find.mockImplementation(async ({ where }: { where?: Record<string, unknown> } = {}) =>
    rows
      .filter((row) =>
        Object.entries(where ?? {}).every(
          ([key, value]) => (row as unknown as Record<string, unknown>)[key] === value,
        ),
      )
      .map((row) => ({
        ...row,
        Ubicacion: catalogo.find((punto) => punto.Id === row.UbicacionId),
      })),
  );
  return base;
}

describe('AsignacionesPuntoVentaService', () => {
  const puntos: InventarioUbicacion[] = [
    { Id: 1, Codigo: 'BODEGA_CENTRAL', Nombre: 'Bodega Central', Activo: true },
    { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA', Activo: true },
    { Id: 3, Codigo: 'POS_EDITORIAL', Nombre: 'Editorial', Activo: true },
    { Id: 4, Codigo: 'POS_WEB', Nombre: 'Plataforma Web', Activo: true },
    { Id: 5, Codigo: 'POS_STAND_FERIAS', Nombre: 'Stand Ferias', Activo: false },
  ];
  const usuarios: Usuario[] = [
    { Id: 7, Roles: ['Vendedor'] } as Usuario,
    { Id: 8, Roles: ['Vendedor'] } as Usuario,
    { Id: 9, Roles: ['Cliente'] } as Usuario,
  ];
  let asignaciones: VendedorPuntoVenta[];
  let service: AsignacionesPuntoVentaService;

  beforeEach(() => {
    asignaciones = [];
    service = new AsignacionesPuntoVentaService(
      repoAsignaciones(asignaciones, puntos) as never,
      repo(puntos) as never,
      repo(usuarios) as never,
    );
  });

  it('solo SuperAdmin gestiona asignaciones en la semilla', () => {
    const permiso = PERMISOS_SEED.find((item) => item.codigo === 'gestionar_asignaciones_puntos');
    expect(permiso?.roles).toEqual(['SuperAdmin']);
  });

  it('asigna varios puntos, evita duplicados y reactiva la misma fila', async () => {
    const primera = await service.asignar(7, 2, 1);
    const repetida = await service.asignar(7, 2, 1);
    expect(repetida.id).toBe(primera.id);
    expect(asignaciones).toHaveLength(1);

    await service.cambiarEstado(7, 2, false, 1);
    const reactivada = await service.asignar(7, 2, 1);
    expect(reactivada.id).toBe(primera.id);
    expect(reactivada.asignacionActiva).toBe(true);
    expect(asignaciones).toHaveLength(1);

    await service.asignar(7, 3, 1);
    expect(asignaciones).toHaveLength(2);
    await service.asignar(8, 2, 1);
    expect(asignaciones.filter((fila) => fila.UbicacionId === 2)).toHaveLength(2);
  });

  it('rechaza bodega, plataforma web y un punto desactivado', async () => {
    await expect(service.asignar(7, 1, 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.asignar(7, 4, 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.asignar(7, 5, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no asigna puntos a quien no es vendedor', async () => {
    await expect(service.asignar(9, 2, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un vendedor sin asignaciones no puede operar y uno con varios solo ve los suyos activos', async () => {
    await expect(service.listarPuntosOperables({ userId: 7, roles: ['Vendedor'] })).resolves.toEqual([]);
    await service.asignar(7, 2, 1);
    await service.asignar(7, 3, 1);
    await service.cambiarEstado(7, 3, false, 1);

    const puntosDeAna = await service.listarPuntosOperables({ userId: 7, roles: ['Vendedor'] });
    expect(puntosDeAna.map((punto) => punto.code)).toEqual(['POS_FUNA_UNA']);

    const admin = await service.listarPuntosOperables({ userId: 1, roles: ['Admin'] });
    expect(admin.map((punto) => punto.code)).toEqual(['POS_FUNA_UNA', 'POS_EDITORIAL']);
  });

  it('impide vender en un punto no asignado y si la asignación se desactiva antes de confirmar', async () => {
    const funa = puntos[1];
    await expect(
      service.exigirVentaEnPunto(7, ['Vendedor'], funa),
    ).rejects.toThrow(MENSAJE_SIN_ASIGNACION);

    await service.asignar(7, 2, 1);
    await expect(service.exigirVentaEnPunto(7, ['Vendedor'], funa)).resolves.toBeUndefined();
    await expect(service.exigirVentaEnPunto(7, ['Admin'], funa)).resolves.toBeUndefined();

    await service.cambiarEstado(7, 2, false, 1);
    await expect(service.exigirVentaEnPunto(7, ['Vendedor'], funa)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('cambia de punto sin borrar la asignación anterior', async () => {
    await service.asignar(7, 2, 1);
    await service.cambiarPunto(7, 2, 3, 1);
    const historial = await service.listarDeVendedor(7);
    expect(historial).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'POS_FUNA_UNA', asignacionActiva: false }),
        expect.objectContaining({ codigo: 'POS_EDITORIAL', asignacionActiva: true }),
      ]),
    );
  });
});
