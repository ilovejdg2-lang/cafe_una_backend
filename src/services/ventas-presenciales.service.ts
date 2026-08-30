import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { MovimientoInventario } from '../entities/movimiento-inventario.entity';
import { Producto } from '../entities/producto.entity';
import { Usuario } from '../entities/usuario.entity';
import { BODEGA_CENTRAL } from './inventario.service';

const TIPO_VENTA_PRESENCIAL = 'Venta presencial';
const CODIGOS_RECHAZADOS = new Set([
  BODEGA_CENTRAL,
  'PLATAFORMA_WEB',
  'POS_WEB',
  'WEB',
]);

export type VentaPresencialResponse = {
  id: string;
  productoId: string;
  productoNombre: string;
  ubicacionId: number;
  ubicacionCodigo: string;
  ubicacionNombre: string;
  cantidad: number;
  fecha: string;
  notas: string;
  stockRestante: number;
  responsableId: number | null;
};

@Injectable()
export class VentasPresencialesService {
  constructor(
    @InjectRepository(InventarioUbicacion)
    private readonly ubicacionesRepo: Repository<InventarioUbicacion>,
    private readonly dataSource: DataSource,
  ) {}

  async listarPuntosPermitidos() {
    const rows = await this.ubicacionesRepo.find({
      where: { Activo: true },
      order: { Nombre: 'ASC' },
    });
    return rows
      .filter((row) => this.esPuntoPresencial(row.Codigo))
      .map((row) => ({
        id: row.Id,
        code: row.Codigo,
        name: row.Nombre,
        activo: row.Activo !== false,
      }));
  }

  async registrar(
    body: Record<string, unknown>,
    responsableId: number | null,
  ): Promise<VentaPresencialResponse> {
    const productoId = String(
      body.productoId ?? body.ProductoId ?? body.producto_id ?? '',
    ).trim();
    if (!productoId || !/^\d+$/.test(productoId)) {
      throw new BadRequestException('El producto es obligatorio.');
    }

    const ubicacionRaw =
      body.ubicacionId ??
      body.UbicacionId ??
      body.ubicacion_id ??
      body.ubicacionCodigo ??
      body.UbicacionCodigo ??
      body.ubicacion ??
      '';
    const cantidad = Number(body.cantidad ?? body.Cantidad ?? 0);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad debe ser un entero positivo.',
      );
    }

    const fechaRaw = String(body.fecha ?? body.Fecha ?? '').trim();
    const fecha = fechaRaw ? new Date(fechaRaw) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha indicada no es válida.');
    }

    const notas = String(body.notas ?? body.Notas ?? '')
      .trim()
      .slice(0, 500);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const ubicacion = await this.resolverUbicacion(
        queryRunner.manager,
        ubicacionRaw,
      );
      if (!this.esPuntoPresencial(ubicacion.Codigo)) {
        throw new BadRequestException(
          'Solo se permiten puntos de venta presenciales (no Bodega Central ni Plataforma Web).',
        );
      }
      if (ubicacion.Activo === false) {
        throw new BadRequestException(
          'El punto de venta seleccionado está inactivo.',
        );
      }

      const producto = await queryRunner.manager.findOne(Producto, {
        where: { Id: productoId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!producto) {
        throw new NotFoundException('El producto no existe.');
      }
      if ((producto.Estado || '').toLowerCase() === 'deshabilitado') {
        throw new BadRequestException(
          `El producto ${producto.Nombre} está deshabilitado.`,
        );
      }

      let balance = await queryRunner.manager.findOne(InventarioStockUbicacion, {
        where: {
          ProductoId: String(producto.Id),
          UbicacionId: ubicacion.Id,
        },
        lock: { mode: 'pessimistic_write' },
      });
      const disponible = Number(balance?.Stock ?? 0) || 0;
      if (disponible < cantidad) {
        throw new BadRequestException(
          `Stock disponible en este punto: ${disponible} unidades.`,
        );
      }

      if (!balance) {
        balance = queryRunner.manager.create(InventarioStockUbicacion, {
          ProductoId: String(producto.Id),
          UbicacionId: ubicacion.Id,
          Stock: disponible,
        });
      }
      balance.Stock = disponible - cantidad;
      await queryRunner.manager.save(balance);

      let responsableNombre = '';
      if (responsableId != null) {
        const usuario = await queryRunner.manager.findOne(Usuario, {
          where: { Id: responsableId },
        });
        responsableNombre = usuario
          ? String(usuario.Nombre || usuario.Correo || `usuario:${responsableId}`).slice(0, 200)
          : `usuario:${responsableId}`;
      }

      const movimiento = await queryRunner.manager.save(
        queryRunner.manager.create(MovimientoInventario, {
          Tipo: TIPO_VENTA_PRESENCIAL,
          ProductoId: String(producto.Id),
          Cantidad: cantidad,
          ResponsableNombre: responsableNombre,
          ResponsableId: responsableId,
          Observaciones: notas,
          Notas: notas,
          SolicitudId: null,
          UbicacionId: ubicacion.Id,
          Fecha: fecha,
        }),
      );

      await queryRunner.commitTransaction();

      return {
        id: String(movimiento.Id),
        productoId: String(producto.Id),
        productoNombre: producto.Nombre,
        ubicacionId: ubicacion.Id,
        ubicacionCodigo: ubicacion.Codigo,
        ubicacionNombre: ubicacion.Nombre,
        cantidad,
        fecha: fecha.toISOString(),
        notas,
        stockRestante: balance.Stock,
        responsableId,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private esPuntoPresencial(codigo: string): boolean {
    const code = String(codigo || '').trim().toUpperCase();
    if (!code || CODIGOS_RECHAZADOS.has(code)) return false;
    if (code.includes('WEB') || code.includes('PLATAFORMA')) return false;
    if (code === BODEGA_CENTRAL) return false;
    return code.startsWith('POS_');
  }

  private async resolverUbicacion(
    manager: EntityManager,
    raw: unknown,
  ): Promise<InventarioUbicacion> {
    const value = String(raw ?? '').trim();
    if (!value) {
      throw new BadRequestException('El punto de venta es obligatorio.');
    }

    let ubicacion: InventarioUbicacion | null = null;
    if (/^\d+$/.test(value)) {
      ubicacion = await manager.findOne(InventarioUbicacion, {
        where: { Id: Number(value) },
      });
    } else {
      ubicacion = await manager.findOne(InventarioUbicacion, {
        where: { Codigo: value.toUpperCase() },
      });
    }

    if (!ubicacion) {
      throw new NotFoundException('El punto de venta no existe.');
    }
    return ubicacion;
  }
}
