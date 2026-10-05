import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { JwtUsuario } from '../common/permisos';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Usuario } from '../entities/usuario.entity';
import { VendedorPuntoVenta } from '../entities/vendedor-punto-venta.entity';
import { esPuntoVentaCliente } from './inventario.service';

export const MENSAJE_SIN_ASIGNACION =
  'No tienes una asignación activa para este punto de venta.';

type UbicacionVisible = {
  id?: number;
  code?: string;
  codigo?: string;
  name?: string;
  nombre?: string;
  activo?: boolean;
};

@Injectable()
export class AsignacionesPuntoVentaService {
  constructor(
    @InjectRepository(VendedorPuntoVenta)
    private readonly asignacionesRepo: Repository<VendedorPuntoVenta>,
    @InjectRepository(InventarioUbicacion)
    private readonly ubicacionesRepo: Repository<InventarioUbicacion>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {}

  async idsUbicacionesActivas(vendedorId: number | null | undefined): Promise<number[]> {
    const id = Number(vendedorId);
    if (!Number.isFinite(id) || id <= 0) return [];
    const filas = await this.asignacionesRepo.find({
      where: { VendedorId: id, Activo: true },
    });
    const puntos = await this.ubicacionesRepo.find();
    const activos = new Set(
      puntos
        .filter((punto) => punto.Activo !== false && esPuntoVentaCliente(punto.Codigo))
        .map((punto) => punto.Id),
    );
    return filas.map((fila) => fila.UbicacionId).filter((ubicacionId) => activos.has(ubicacionId));
  }

  async listarDeVendedor(vendedorId: number) {
    await this.assertVendedor(vendedorId);
    const filas = await this.asignacionesRepo.find({
      where: { VendedorId: vendedorId },
      order: { Id: 'ASC' },
    });
    const puntos = await this.ubicacionesRepo.find();
    const porId = new Map(puntos.map((punto) => [punto.Id, punto]));
    return filas.map((fila) => this.mapear(fila, porId.get(fila.UbicacionId)));
  }

  async listarPuntosElegibles() {
    const puntos = await this.ubicacionesRepo.find({ order: { Nombre: 'ASC' } });
    return puntos
      .filter((punto) => punto.Activo !== false && esPuntoVentaCliente(punto.Codigo))
      .map((punto) => this.mapearPunto(punto));
  }

  async listarPuntosOperables(actor: JwtUsuario) {
    if (omiteAsignacionDePunto(actor?.roles)) {
      return this.listarPuntosElegibles();
    }
    if (actor?.userId == null) return [];
    const filas = await this.asignacionesRepo.find({
      where: { VendedorId: actor.userId, Activo: true },
      order: { Id: 'ASC' },
    });
    const puntos = await this.ubicacionesRepo.find();
    const porId = new Map(puntos.map((punto) => [punto.Id, punto]));
    return filas
      .map((fila) => porId.get(fila.UbicacionId))
      .filter((punto): punto is InventarioUbicacion => {
        if (!punto) return false;
        return punto.Activo !== false && esPuntoVentaCliente(punto.Codigo);
      })
      .map((punto) => this.mapearPunto(punto));
  }

  async asignarVarios(
    vendedorId: number,
    ubicacionIds: number[],
    actorId: number | null,
  ) {
    const ids = [...new Set(ubicacionIds.map((id) => Number(id)).filter((id) => id > 0))];
    if (ids.length === 0) {
      throw new BadRequestException('Seleccioná al menos un punto de venta.');
    }
    const resultado = [];
    for (const ubicacionId of ids) {
      resultado.push(await this.asignar(vendedorId, ubicacionId, actorId));
    }
    return resultado;
  }

  async asignar(vendedorId: number, ubicacionId: number, actorId: number | null) {
    await this.assertVendedor(vendedorId);
    const ubicacion = await this.assertPuntoAsignable(ubicacionId);
    const ahora = new Date();
    const existente = await this.asignacionesRepo.findOne({
      where: { VendedorId: vendedorId, UbicacionId: ubicacion.Id },
    });
    if (existente) {
      if (!existente.Activo) {
        existente.Activo = true;
        existente.AsignadoPorId = actorId;
        existente.ActualizadoEn = ahora;
        const guardada = await this.asignacionesRepo.save(existente);
        return this.mapear(guardada, ubicacion);
      }
      return this.mapear(existente, ubicacion);
    }
    const creada = await this.asignacionesRepo.save(
      this.asignacionesRepo.create({
        VendedorId: vendedorId,
        UbicacionId: ubicacion.Id,
        Activo: true,
        CreadoEn: ahora,
        ActualizadoEn: ahora,
        AsignadoPorId: actorId,
      }),
    );
    return this.mapear(creada, ubicacion);
  }

  async cambiarEstado(
    vendedorId: number,
    ubicacionId: number,
    activo: boolean,
    actorId: number | null,
  ) {
    await this.assertVendedor(vendedorId);
    const fila = await this.asignacionesRepo.findOne({
      where: { VendedorId: vendedorId, UbicacionId: ubicacionId },
    });
    if (!fila) throw new NotFoundException('La asignación no existe.');
    if (activo) {
      await this.assertPuntoAsignable(ubicacionId);
    }
    fila.Activo = activo;
    fila.AsignadoPorId = actorId;
    fila.ActualizadoEn = new Date();
    const guardada = await this.asignacionesRepo.save(fila);
    const ubicacion = await this.ubicacionesRepo.findOne({ where: { Id: ubicacionId } });
    return this.mapear(guardada, ubicacion);
  }

  async cambiarPunto(
    vendedorId: number,
    desdeUbicacionId: number,
    haciaUbicacionId: number,
    actorId: number | null,
  ) {
    if (desdeUbicacionId === haciaUbicacionId) {
      throw new BadRequestException('Elegí un punto de venta distinto.');
    }
    await this.cambiarEstado(vendedorId, desdeUbicacionId, false, actorId);
    try {
      return await this.asignar(vendedorId, haciaUbicacionId, actorId);
    } catch (error) {
      await this.cambiarEstado(vendedorId, desdeUbicacionId, true, actorId).catch(() => undefined);
      throw error;
    }
  }

  async exigirVentaEnPunto(
    vendedorId: number | null,
    roles: string[] | undefined,
    ubicacion: InventarioUbicacion,
    manager?: EntityManager,
  ): Promise<void> {
    if (omiteAsignacionDePunto(roles)) return;
    if (vendedorId == null) {
      throw new ForbiddenException(MENSAJE_SIN_ASIGNACION);
    }
    const repo = manager
      ? manager.getRepository(VendedorPuntoVenta)
      : this.asignacionesRepo;
    const fila = await repo.findOne({
      where: {
        VendedorId: vendedorId,
        UbicacionId: ubicacion.Id,
        Activo: true,
      },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!fila) throw new ForbiddenException(MENSAJE_SIN_ASIGNACION);
  }

  async exigirConsultaPunto(
    actor: JwtUsuario | undefined,
    locationCode: string,
  ): Promise<void> {
    if (omiteAsignacionDePunto(actor?.roles)) return;
    const codigo = String(locationCode || '').trim().toUpperCase();
    const ubicacion = codigo
      ? await this.ubicacionesRepo.findOne({ where: { Codigo: codigo } })
      : null;
    if (!ubicacion || !esPuntoVentaCliente(ubicacion.Codigo) || ubicacion.Activo === false) {
      throw new ForbiddenException(MENSAJE_SIN_ASIGNACION);
    }
    await this.exigirVentaEnPunto(actor?.userId ?? null, actor?.roles, ubicacion);
  }

  async filtrarUbicacionesVisibles<T extends UbicacionVisible>(
    actor: JwtUsuario | undefined,
    ubicaciones: T[],
  ): Promise<T[]> {
    if (omiteAsignacionDePunto(actor?.roles)) return ubicaciones;
    const permitidos = new Set(
      (await this.listarPuntosOperables({
        userId: actor?.userId ?? 0,
        roles: actor?.roles ?? [],
      })).map((punto) => punto.code),
    );
    return ubicaciones.filter((punto) => permitidos.has(codigoDe(punto)));
  }

  private async assertVendedor(vendedorId: number): Promise<Usuario> {
    if (!Number.isFinite(vendedorId) || vendedorId <= 0) {
      throw new BadRequestException('El vendedor no es válido.');
    }
    const usuario = await this.usuariosRepo.findOne({ where: { Id: vendedorId } });
    if (!usuario) throw new NotFoundException('El vendedor no existe.');
    const roles = (usuario.Roles ?? []).map((rol) => String(rol).trim().toLowerCase());
    if (!roles.includes('vendedor')) {
      throw new BadRequestException('Solo se pueden asignar puntos a un vendedor.');
    }
    return usuario;
  }

  private async assertPuntoAsignable(ubicacionId: number): Promise<InventarioUbicacion> {
    const ubicacion = await this.ubicacionesRepo.findOne({ where: { Id: ubicacionId } });
    if (!ubicacion) throw new NotFoundException('El punto de venta no existe.');
    if (!esPuntoVentaCliente(ubicacion.Codigo)) {
      throw new BadRequestException(
        'Solo se pueden asignar puntos de venta presenciales.',
      );
    }
    if (ubicacion.Activo === false) {
      throw new BadRequestException('El punto de venta está desactivado.');
    }
    return ubicacion;
  }

  private mapear(fila: VendedorPuntoVenta, ubicacion?: InventarioUbicacion | null) {
    return {
      id: fila.Id,
      vendedorId: fila.VendedorId,
      ubicacionId: fila.UbicacionId,
      codigo: ubicacion?.Codigo ?? '',
      nombre: ubicacion?.Nombre ?? '',
      asignacionActiva: fila.Activo === true,
      puntoActivo: ubicacion ? ubicacion.Activo !== false : false,
      creadoEn: fila.CreadoEn,
      actualizadoEn: fila.ActualizadoEn,
      asignadoPorId: fila.AsignadoPorId,
    };
  }

  private mapearPunto(punto: InventarioUbicacion) {
    return {
      id: punto.Id,
      code: punto.Codigo,
      name: punto.Nombre,
      activo: punto.Activo !== false,
    };
  }
}

export function omiteAsignacionDePunto(roles: string[] | undefined): boolean {
  return (roles ?? []).some((rol) => {
    const valor = String(rol || '').trim().toLowerCase();
    return (
      valor === 'admin' ||
      valor === 'administrador' ||
      valor === 'superadmin' ||
      valor === 'superadministrador'
    );
  });
}

function codigoDe(punto: UbicacionVisible): string {
  return String(punto.code || punto.codigo || '').trim().toUpperCase();
}
