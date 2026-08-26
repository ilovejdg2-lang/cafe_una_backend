import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { tienePermiso } from '../common/permisos';
import { CompraItem } from '../entities/compra-item.entity';
import { Compra } from '../entities/compra.entity';

type CompraBody = Record<string, unknown> | undefined | null;

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
    @InjectRepository(CompraItem)
    private readonly itemsRepository: Repository<CompraItem>,
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

    const items = itemsRaw.map((item) => this.validarItem(item as Record<string, unknown>));
    const subtotal = this.numero(body?.subtotal ?? body?.Subtotal, items.reduce((a, i) => a + i.subtotal, 0));
    const impuestos = this.numero(body?.impuestos ?? body?.Impuestos ?? body?.iva ?? body?.Iva, 0);
    const total = this.numero(body?.total ?? body?.Total, subtotal + impuestos);
    const clienteNombre = String(
      body?.clienteNombre ?? body?.ClienteNombre ?? body?.cliente ?? body?.Cliente ?? 'Cliente',
    ).trim() || 'Cliente';
    const clienteCorreo = String(
      body?.clienteCorreo ?? body?.ClienteCorreo ?? body?.correo ?? body?.Correo ?? '',
    ).trim();
    const metodoPago = String(
      body?.metodoPago ?? body?.MetodoPago ?? body?.metodo ?? body?.Metodo ?? 'Tarjeta',
    ).trim() || 'Tarjeta';
    const estado = String(
      body?.estado ?? body?.Estado ?? body?.estadoPago ?? body?.EstadoPago ?? 'Pagado',
    ).trim() || 'Pagado';

    const numero =
      String(body?.numero ?? body?.Numero ?? '').trim() ||
      `C-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

    const compra = await this.comprasRepository.save(
      this.comprasRepository.create({
        Numero: numero.slice(0, 40),
        UsuarioId: usuarioId,
        ClienteNombre: clienteNombre.slice(0, 150),
        ClienteCorreo: clienteCorreo.slice(0, 150),
        Fecha: new Date(),
        Subtotal: subtotal.toFixed(2),
        Impuestos: impuestos.toFixed(2),
        Total: total.toFixed(2),
        MetodoPago: metodoPago.slice(0, 50),
        Estado: estado.slice(0, 40),
        FacturaId: null,
      }),
    );

    await this.itemsRepository.save(
      items.map((item) =>
        this.itemsRepository.create({
          CompraId: compra.Id,
          ProductoId: item.productoId,
          Nombre: item.nombre,
          Cantidad: item.cantidad,
          PrecioUnitario: item.precioUnitario.toFixed(2),
          Subtotal: item.subtotal.toFixed(2),
        }),
      ),
    );

    return this.obtenerDetalleAutorizado(compra.Id, usuarioId, ['Cliente'], true);
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
      qb.andWhere('compra.Estado ILIKE :estado', {
        estado: query.estado.trim(),
      });
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

  private validarItem(item: Record<string, unknown>) {
    const nombre = String(item.nombre ?? item.Nombre ?? '').trim();
    if (!nombre) throw new BadRequestException('Cada ítem requiere nombre.');
    const cantidad = Number(item.cantidad ?? item.Cantidad ?? item.units ?? item.Units ?? 0);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new BadRequestException('La cantidad debe ser un entero positivo.');
    }
    const precioUnitario = this.numero(
      item.precioUnitario ?? item.PrecioUnitario ?? item.precio ?? item.Precio,
      0,
    );
    const subtotal = this.numero(
      item.subtotal ?? item.Subtotal ?? item.total ?? item.Total,
      precioUnitario * cantidad,
    );
    return {
      productoId: String(item.productoId ?? item.ProductoId ?? item.id ?? item.Id ?? ''),
      nombre: nombre.slice(0, 200),
      cantidad,
      precioUnitario,
      subtotal,
    };
  }

  private numero(valor: unknown, fallback = 0): number {
    const n = typeof valor === 'number' ? valor : Number(valor);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  private mapearResumen(compra: Compra): CompraResumen {
    const items = compra.Items || [];
    return {
      id: Number(compra.Id),
      numero: compra.Numero,
      fecha: compra.Fecha?.toISOString?.() || String(compra.Fecha),
      clienteNombre: compra.ClienteNombre,
      clienteCorreo: compra.ClienteCorreo,
      cantidadProductos: items.reduce((acc, item) => acc + (Number(item.Cantidad) || 0), 0),
      subtotal: Number(compra.Subtotal) || 0,
      impuestos: Number(compra.Impuestos) || 0,
      total: Number(compra.Total) || 0,
      metodoPago: compra.MetodoPago,
      estado: compra.Estado,
      facturaId: compra.FacturaId,
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
