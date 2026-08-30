import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { tienePermiso } from '../common/permisos';
import { CompraItem } from '../entities/compra-item.entity';
import { Compra } from '../entities/compra.entity';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { BODEGA_CENTRAL } from './inventario.service';

type CompraBody = Record<string, unknown> | undefined | null;

/** Pedido: Pendiente → Aceptado|Rechazado; Aceptado → Enviado|Pendiente; Enviado cerrado. */
export const ESTADOS_COMPRA = [
  'Pendiente',
  'Aceptado',
  'Enviado',
  'Rechazado',
] as const;
export type EstadoCompra = (typeof ESTADOS_COMPRA)[number];

const ESTADOS_CERRADOS = new Set(['Enviado', 'Enviada', 'Recibido', 'Pagado']);

/** Estados en los que el stock ya se bajó. */
const ESTADOS_CON_STOCK = new Set([
  'Aceptado',
  'Aprobado',
  'Aprobada',
  'Enviado',
  'Enviada',
  'Recibido',
  'Pagado',
]);

function normalizarEstadoCompra(estadoRaw: string): string {
  const estado = (estadoRaw || '').trim();
  if (estado === 'Aprobado' || estado === 'Aprobada') return 'Aceptado';
  if (estado === 'Recibido' || estado === 'Enviada' || estado === 'Pagado') {
    return 'Enviado';
  }
  if (estado === 'Rechazada') return 'Rechazado';
  return estado || 'Pendiente';
}

function stockYaDescontado(estado: string): boolean {
  return ESTADOS_CON_STOCK.has(estado);
}

function transicionPermitida(actual: string, nuevo: string): boolean {
  if (actual === nuevo) return true;
  if (actual === 'Pendiente') {
    return nuevo === 'Aceptado' || nuevo === 'Rechazado';
  }
  if (actual === 'Aceptado') {
    return nuevo === 'Enviado' || nuevo === 'Pendiente';
  }
  if (actual === 'Rechazado') {
    return nuevo === 'Pendiente';
  }
  return false;
}

export type CompraResumen = {
  id: number;
  numero: string;
  fecha: string;
  clienteNombre: string;
  clienteCorreo: string;
  cantidadProductos: number;
  subtotal: number;
  impuestos: number;
  total: number;
  metodoPago: string;
  estado: string;
  facturaId: string | null;
  editable: boolean;
  ganado: number | null;
};

export type CompraDetalle = CompraResumen & {
  items: Array<{
    productoId: string;
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
};

@Injectable()
export class ComprasService {
  constructor(
    @InjectRepository(Compra)
    private readonly comprasRepository: Repository<Compra>,
    private readonly dataSource: DataSource,
  ) {}

  async registrar(body: CompraBody, usuarioId: number | null): Promise<CompraDetalle> {
    const itemsRaw = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.Items)
        ? body.Items
        : [];
    if (itemsRaw.length === 0) {
      throw new BadRequestException('La compra debe incluir al menos un producto.');
    }

    const itemsSolicitados = itemsRaw.map((item) =>
      this.validarItemSolicitud(item as Record<string, unknown>),
    );

    const clienteNombre =
      String(
        body?.clienteNombre ??
          body?.ClienteNombre ??
          body?.cliente ??
          body?.Cliente ??
          'Cliente',
      ).trim() || 'Cliente';
    const clienteCorreo = String(
      body?.clienteCorreo ??
        body?.ClienteCorreo ??
        body?.correo ??
        body?.Correo ??
        '',
    ).trim();
    const metodoPago =
      String(
        body?.metodoPago ??
          body?.MetodoPago ??
          body?.metodo ??
          body?.Metodo ??
          'Tarjeta',
      ).trim() || 'Tarjeta';
    const estado: EstadoCompra = 'Pendiente';
    const numero =
      String(body?.numero ?? body?.Numero ?? '').trim() ||
      `C-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const itemsCalculados: Array<{
        productoId: string;
        nombre: string;
        cantidad: number;
        precioUnitario: number;
        subtotal: number;
      }> = [];

      let subtotal = 0;
      let total = 0;

      const central = await queryRunner.manager.findOne(InventarioUbicacion, {
        where: { Codigo: BODEGA_CENTRAL },
      });
      if (!central) {
        throw new BadRequestException(
          'La Bodega Central no está inicializada.',
        );
      }

      for (const solicitado of itemsSolicitados) {
        const producto = await queryRunner.manager.findOne(Producto, {
          where: { Id: solicitado.productoId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!producto) {
          throw new BadRequestException(
            `No se encontró el producto con id ${solicitado.productoId}.`,
          );
        }
        if ((producto.Estado || '').toLowerCase() === 'deshabilitado') {
          throw new BadRequestException(
            `El producto ${producto.Nombre} está deshabilitado.`,
          );
        }

        const balance = await queryRunner.manager.findOne(
          InventarioStockUbicacion,
          {
            where: {
              ProductoId: String(producto.Id),
              UbicacionId: central.Id,
            },
            lock: { mode: 'pessimistic_write' },
          },
        );
        const stockUbicacion = Number(balance?.Stock ?? producto.Stock) || 0;
        if (stockUbicacion < solicitado.cantidad) {
          throw new BadRequestException(
            `No hay stock suficiente para ${producto.Nombre}.`,
          );
        }

        const precioNormal = this.numero(producto.PrecioNormal, 0);
        const precioConIva = this.numero(producto.PrecioConIVA, precioNormal);
        const precioUnitario = precioConIva > 0 ? precioConIva : precioNormal;
        const itemSubtotal = precioUnitario * solicitado.cantidad;
        const baseSinIva =
          (precioNormal > 0 ? precioNormal : precioUnitario) *
          solicitado.cantidad;

        subtotal += baseSinIva;
        total += itemSubtotal;

        itemsCalculados.push({
          productoId: String(producto.Id),
          nombre: producto.Nombre.slice(0, 200),
          cantidad: solicitado.cantidad,
          precioUnitario,
          subtotal: itemSubtotal,
        });
      }

      const impuestos = Math.max(0, total - subtotal);

      const compra = await queryRunner.manager.save(
        queryRunner.manager.create(Compra, {
          Numero: numero.slice(0, 40),
          UsuarioId: usuarioId,
          ClienteNombre: clienteNombre.slice(0, 150),
          ClienteCorreo: clienteCorreo.slice(0, 150),
          Fecha: new Date(),
          Subtotal: subtotal.toFixed(2),
          Impuestos: impuestos.toFixed(2),
          Total: total.toFixed(2),
          MetodoPago: metodoPago.slice(0, 50),
          Estado: estado,
          FacturaId: null,
        }),
      );

      await queryRunner.manager.save(
        itemsCalculados.map((item) =>
          queryRunner.manager.create(CompraItem, {
            CompraId: compra.Id,
            ProductoId: item.productoId,
            Nombre: item.nombre,
            Cantidad: item.cantidad,
            PrecioUnitario: item.precioUnitario.toFixed(2),
            Subtotal: item.subtotal.toFixed(2),
          }),
        ),
      );

      await queryRunner.commitTransaction();
      return this.obtenerDetalleAutorizado(compra.Id, usuarioId, ['Cliente'], true);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cambiarEstado(
    id: number | string,
    estadoRaw: unknown,
  ): Promise<CompraDetalle> {
    const compraId = Number(id);
    if (!Number.isFinite(compraId) || compraId <= 0) {
      throw new BadRequestException('El identificador de compra no es válido.');
    }
    const nuevoEstado = String(estadoRaw ?? '').trim();
    if (!ESTADOS_COMPRA.includes(nuevoEstado as EstadoCompra)) {
      throw new BadRequestException(
        'El estado debe ser Pendiente, Aceptado, Enviado o Rechazado.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const compra = await queryRunner.manager.findOne(Compra, {
        where: { Id: compraId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!compra) {
        throw new NotFoundException('La compra no existe.');
      }
      const items = await queryRunner.manager.find(CompraItem, {
        where: { CompraId: compraId },
      });
      compra.Items = items;

      const actual = normalizarEstadoCompra(compra.Estado || '');
      if (ESTADOS_CERRADOS.has(actual) || ESTADOS_CERRADOS.has((compra.Estado || '').trim())) {
        throw new BadRequestException(
          'Esta compra ya está cerrada y no se puede editar.',
        );
      }

      if (!transicionPermitida(actual, nuevoEstado)) {
        throw new BadRequestException(
          `No se puede pasar de ${actual} a ${nuevoEstado}.`,
        );
      }

      if (nuevoEstado === actual) {
        await queryRunner.commitTransaction();
        return this.mapearDetalle({ ...compra, Items: items, Estado: actual });
      }

      const teniaStock = stockYaDescontado(actual);
      const necesitaStock = stockYaDescontado(nuevoEstado);

      if (necesitaStock && !teniaStock) {
        await this.descontarStockDeItems(queryRunner.manager, items);
      } else if (!necesitaStock && teniaStock) {
        await this.restaurarStockDeItems(queryRunner.manager, items);
      }

      compra.Estado = nuevoEstado;
      await queryRunner.manager.save(compra);
      await queryRunner.commitTransaction();

      return this.mapearDetalle(
        (await this.comprasRepository.findOne({
          where: { Id: compraId },
          relations: ['Items'],
        })) as Compra,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async listarPropias(
    usuarioId: number,
    query: Record<string, string | undefined>,
  ) {
    return this.listar({
      ...query,
      usuarioId: String(usuarioId),
    });
  }

  async listar(query: Record<string, string | undefined>) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
    const qb = this.comprasRepository
      .createQueryBuilder('compra')
      .leftJoinAndSelect('compra.Items', 'items')
      .orderBy('compra.Fecha', 'DESC');

    if (query.usuarioId) {
      qb.andWhere('compra.UsuarioId = :usuarioId', {
        usuarioId: Number(query.usuarioId),
      });
    }
    if (query.q?.trim()) {
      qb.andWhere(
        '(compra.Numero ILIKE :q OR compra.ClienteNombre ILIKE :q OR compra.ClienteCorreo ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    } else {
      if (query.numero?.trim()) {
        qb.andWhere('compra.Numero ILIKE :numero', {
          numero: `%${query.numero.trim()}%`,
        });
      }
      if (query.cliente?.trim()) {
        qb.andWhere(
          '(compra.ClienteNombre ILIKE :cliente OR compra.ClienteCorreo ILIKE :cliente)',
          { cliente: `%${query.cliente.trim()}%` },
        );
      }
    }
    if (query.estado?.trim() && query.estado !== 'todos') {
      const estadoFiltro = normalizarEstadoCompra(query.estado.trim());
      if (estadoFiltro === 'Aceptado') {
        qb.andWhere('compra.Estado IN (:...estados)', {
          estados: ['Aceptado', 'Aprobado', 'Aprobada'],
        });
      } else if (estadoFiltro === 'Enviado') {
        qb.andWhere('compra.Estado IN (:...estados)', {
          estados: ['Enviado', 'Enviada', 'Recibido', 'Pagado'],
        });
      } else if (estadoFiltro === 'Rechazado') {
        qb.andWhere('compra.Estado IN (:...estados)', {
          estados: ['Rechazado', 'Rechazada'],
        });
      } else {
        qb.andWhere('compra.Estado ILIKE :estado', {
          estado: estadoFiltro,
        });
      }
    }
    if (query.desde) {
      qb.andWhere('compra.Fecha >= :desde', {
        desde: new Date(`${query.desde}T00:00:00`),
      });
    }
    if (query.hasta) {
      qb.andWhere('compra.Fecha <= :hasta', {
        hasta: new Date(`${query.hasta}T23:59:59`),
      });
    }
    if (query.montoMin) {
      qb.andWhere('compra.Total >= :montoMin', {
        montoMin: Number(query.montoMin),
      });
    }
    if (query.montoMax) {
      qb.andWhere('compra.Total <= :montoMax', {
        montoMax: Number(query.montoMax),
      });
    }

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: rows.map((row) => this.mapearResumen(row)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async obtenerDetalleAutorizado(
    id: number | string,
    usuarioId: number | null,
    roles: string[],
    forRegistrar = false,
  ): Promise<CompraDetalle> {
    const compraId = Number(id);
    if (!Number.isFinite(compraId) || compraId <= 0) {
      throw new BadRequestException('El identificador de compra no es válido.');
    }
    const compra = await this.comprasRepository.findOne({
      where: { Id: compraId },
      relations: ['Items'],
    });
    if (!compra) throw new NotFoundException('La compra no existe.');

    if (!forRegistrar) {
      const puedeVerTodas =
        tienePermiso(roles, 'ver_historial_compras_clientes') ||
        tienePermiso(roles, 'ver_ventas');
      const esPropia =
        usuarioId != null && Number(compra.UsuarioId) === Number(usuarioId);
      if (!puedeVerTodas && !esPropia) {
        throw new ForbiddenException(
          'No tiene permiso para consultar esta compra.',
        );
      }
    }

    return this.mapearDetalle(compra);
  }

  private async descontarStockDeItems(
    manager: EntityManager,
    items: CompraItem[],
  ): Promise<void> {
    const central = await manager.findOne(InventarioUbicacion, {
      where: { Codigo: BODEGA_CENTRAL },
    });
    if (!central) {
      throw new BadRequestException(
        'La Bodega Central no está inicializada.',
      );
    }

    for (const item of items) {
      const cantidad = Number(item.Cantidad) || 0;
      if (cantidad <= 0) continue;

      const producto = await manager.findOne(Producto, {
        where: { Id: item.ProductoId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!producto) {
        throw new BadRequestException(
          `No se encontró el producto ${item.Nombre || item.ProductoId}.`,
        );
      }

      let balance = await manager.findOne(InventarioStockUbicacion, {
        where: {
          ProductoId: String(producto.Id),
          UbicacionId: central.Id,
        },
        lock: { mode: 'pessimistic_write' },
      });
      const stockUbicacion = Number(balance?.Stock ?? producto.Stock) || 0;
      if (stockUbicacion < cantidad) {
        throw new BadRequestException(
          `No hay stock suficiente para ${producto.Nombre}.`,
        );
      }

      if (!balance) {
        balance = manager.create(InventarioStockUbicacion, {
          ProductoId: String(producto.Id),
          UbicacionId: central.Id,
          Stock: stockUbicacion,
        });
      }
      balance.Stock = stockUbicacion - cantidad;
      producto.Stock = balance.Stock;
      if (producto.Stock <= 0) {
        producto.Stock = 0;
        producto.EsDestacado = false;
        producto.Disponible = false;
      }
      producto.AlertaStock = producto.Stock <= (producto.StockMinimo ?? 0);
      await manager.save(balance);
      await manager.save(producto);
    }
  }

  private async restaurarStockDeItems(
    manager: EntityManager,
    items: CompraItem[],
  ): Promise<void> {
    const central = await manager.findOne(InventarioUbicacion, {
      where: { Codigo: BODEGA_CENTRAL },
    });
    if (!central) {
      throw new BadRequestException(
        'La Bodega Central no está inicializada.',
      );
    }

    for (const item of items) {
      const cantidad = Number(item.Cantidad) || 0;
      if (cantidad <= 0) continue;

      const producto = await manager.findOne(Producto, {
        where: { Id: item.ProductoId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!producto) {
        throw new BadRequestException(
          `No se encontró el producto ${item.Nombre || item.ProductoId}.`,
        );
      }

      let balance = await manager.findOne(InventarioStockUbicacion, {
        where: {
          ProductoId: String(producto.Id),
          UbicacionId: central.Id,
        },
        lock: { mode: 'pessimistic_write' },
      });
      const stockUbicacion = Number(balance?.Stock ?? producto.Stock) || 0;
      if (!balance) {
        balance = manager.create(InventarioStockUbicacion, {
          ProductoId: String(producto.Id),
          UbicacionId: central.Id,
          Stock: stockUbicacion,
        });
      }
      balance.Stock = stockUbicacion + cantidad;
      producto.Stock = balance.Stock;
      if (producto.Stock > 0) {
        producto.Disponible = true;
      }
      producto.AlertaStock = producto.Stock <= (producto.StockMinimo ?? 0);
      await manager.save(balance);
      await manager.save(producto);
    }
  }

  private validarItemSolicitud(item: Record<string, unknown>) {
    const productoId = String(
      item.productoId ?? item.ProductoId ?? item.id ?? item.Id ?? '',
    ).trim();
    if (!productoId) {
      throw new BadRequestException('Cada ítem requiere productoId.');
    }
    const cantidad = Number(
      item.cantidad ?? item.Cantidad ?? item.units ?? item.Units ?? 0,
    );
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new BadRequestException('La cantidad debe ser un entero positivo.');
    }
    return { productoId, cantidad };
  }

  private numero(valor: unknown, fallback = 0): number {
    const n = typeof valor === 'number' ? valor : Number(valor);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  private mapearResumen(compra: Compra): CompraResumen {
    const items = compra.Items || [];
    const estado = normalizarEstadoCompra(compra.Estado || '');
    const esGanada = estado === 'Enviado';
    const total = Number(compra.Total) || 0;
    return {
      id: Number(compra.Id),
      numero: compra.Numero,
      fecha: compra.Fecha?.toISOString?.() || String(compra.Fecha),
      clienteNombre: compra.ClienteNombre,
      clienteCorreo: compra.ClienteCorreo,
      cantidadProductos: items.reduce((acc, item) => acc + (Number(item.Cantidad) || 0), 0),
      subtotal: Number(compra.Subtotal) || 0,
      impuestos: Number(compra.Impuestos) || 0,
      total,
      metodoPago: compra.MetodoPago,
      estado,
      facturaId: compra.FacturaId,
      editable: estado === 'Pendiente' || estado === 'Aceptado' || estado === 'Rechazado',
      ganado: esGanada ? total : null,
    };
  }

  private mapearDetalle(compra: Compra): CompraDetalle {
    return {
      ...this.mapearResumen(compra),
      items: (compra.Items || []).map((item) => ({
        productoId: item.ProductoId,
        nombre: item.Nombre,
        cantidad: Number(item.Cantidad) || 0,
        precioUnitario: Number(item.PrecioUnitario) || 0,
        subtotal: Number(item.Subtotal) || 0,
      })),
    };
  }
}
