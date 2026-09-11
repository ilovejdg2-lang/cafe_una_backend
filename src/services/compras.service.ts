import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  insertarMovimientoInventario,
  TIPO_MOVIMIENTO,
} from '../common/movimiento-inventario.util';
import { CompraItem } from '../entities/compra-item.entity';
import { Compra } from '../entities/compra.entity';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Usuario } from '../entities/usuario.entity';
import { ClientesService } from './clientes.service';
import { BODEGA_CENTRAL, esPuntoVentaCliente } from './inventario.service';

type CompraBody = Record<string, unknown> | undefined | null;

/** Pedido: Pendiente → Aceptado|Rechazado; Aceptado → Entregado|Pendiente; Entregado cerrado. */
export const ESTADOS_COMPRA = [
  'Pendiente',
  'Aceptado',
  'Entregado',
  'Enviado',
  'Rechazado',
] as const;
export type EstadoCompra = (typeof ESTADOS_COMPRA)[number];

const ESTADOS_CERRADOS = new Set([
  'Entregado',
  'Enviado',
  'Enviada',
  'Recibido',
  'Pagado',
]);

/** Estados en los que el stock ya se bajó. */
const ESTADOS_CON_STOCK = new Set([
  'Aceptado',
  'Aprobado',
  'Aprobada',
  'Entregado',
  'Enviado',
  'Enviada',
  'Recibido',
  'Pagado',
]);

function normalizarEstadoCompra(estadoRaw: string): string {
  const estado = (estadoRaw || '').trim();
  if (estado === 'Aprobado' || estado === 'Aprobada') return 'Aceptado';
  if (
    estado === 'Recibido' ||
    estado === 'Enviada' ||
    estado === 'Enviado' ||
    estado === 'Pagado'
  ) {
    return 'Entregado';
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
    return nuevo === 'Entregado' || nuevo === 'Enviado' || nuevo === 'Pendiente';
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
  usuarioId: number | null;
  vendedorNombre: string;
  vendedorCorreo: string;
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
  ubicacionId: number | null;
  ubicacionCodigo: string | null;
  ubicacionNombre: string | null;
  tieneComprobante: boolean;
};

export type CompraClienteInfo = {
  tipo: string | null;
  nombre: string | null;
  apellidos: string | null;
  correo: string;
  telefono: string | null;
  tipoDocumento: string | null;
  identificacion: string | null;
  razonSocial: string | null;
  nombreComercial: string | null;
  representanteLegal: string | null;
  cedulaJuridica: string | null;
  direccionFiscal: string | null;
  telefonoOficina: string | null;
};

export type CompraDetalle = CompraResumen & {
  items: Array<{
    productoId: string;
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
  cliente: CompraClienteInfo | null;
};

@Injectable()
export class ComprasService {
  constructor(
    @InjectRepository(Compra)
    private readonly comprasRepository: Repository<Compra>,
    private readonly dataSource: DataSource,
    private readonly clientesService: ClientesService,
  ) {}

  async registrar(body: CompraBody, usuarioId: number | null): Promise<CompraDetalle> {
    const itemsRaw = this.extraerItemsRaw(body);
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
          'Comprobante',
      ).trim() || 'Comprobante';
    const comprobanteArchivo =
      String(
        body?.comprobanteArchivo ?? body?.ComprobanteArchivo ?? '',
      ).trim() || '';
    if (!comprobanteArchivo) {
      throw new BadRequestException(
        'Debés adjuntar el comprobante de pago para completar la compra.',
      );
    }
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

      const ubicacion = await this.resolverUbicacionCliente(
        queryRunner.manager,
        body,
      );

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
              UbicacionId: ubicacion.Id,
            },
            lock: { mode: 'pessimistic_write' },
          },
        );
        const stockUbicacion = Number(balance?.Stock) || 0;
        if (stockUbicacion < solicitado.cantidad) {
          throw new BadRequestException(
            `No hay stock suficiente de ${producto.Nombre} en ${ubicacion.Nombre}. Disponible: ${stockUbicacion}.`,
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
          UbicacionId: Number(ubicacion.Id),
          ComprobanteArchivo: comprobanteArchivo.slice(0, 200),
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
    const nuevoEstado = normalizarEstadoCompra(String(estadoRaw ?? '').trim());
    if (
      nuevoEstado !== 'Pendiente' &&
      nuevoEstado !== 'Aceptado' &&
      nuevoEstado !== 'Entregado' &&
      nuevoEstado !== 'Rechazado'
    ) {
      throw new BadRequestException(
        'El estado debe ser Pendiente, Aceptado, Entregado o Rechazado.',
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
        return this.mapearDetalleCompleto({ ...compra, Items: items, Estado: actual });
      }

      const teniaStock = stockYaDescontado(actual);
      const necesitaStock = stockYaDescontado(nuevoEstado);

      if (necesitaStock && !teniaStock) {
        await this.descontarStockDeItems(queryRunner.manager, items, compra);
      } else if (!necesitaStock && teniaStock) {
        await this.restaurarStockDeItems(queryRunner.manager, items, compra);
      }

      compra.Estado = nuevoEstado;
      await queryRunner.manager.save(compra);
      await queryRunner.commitTransaction();

      return this.mapearDetalleCompleto(
        (await this.comprasRepository.findOne({
          where: { Id: compraId },
          relations: ['Items', 'Usuario', 'Ubicacion'],
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
      .leftJoinAndSelect('compra.Usuario', 'usuario')
      .leftJoinAndSelect('compra.Ubicacion', 'ubicacion')
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
      } else if (estadoFiltro === 'Entregado') {
        qb.andWhere('compra.Estado IN (:...estados)', {
          estados: ['Entregado', 'Enviado', 'Enviada', 'Recibido', 'Pagado'],
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
    const ubicacionCodigo = String(
      query.ubicacionCodigo ?? query.locationCode ?? '',
    )
      .trim()
      .toUpperCase();
    if (ubicacionCodigo) {
      qb.andWhere('ubicacion.Codigo = :ubicacionCodigo', { ubicacionCodigo });
    }
    const ubicacionId = Number(query.ubicacionId);
    if (Number.isFinite(ubicacionId) && ubicacionId > 0) {
      qb.andWhere('compra.UbicacionId = :ubicacionId', { ubicacionId });
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
      relations: ['Items', 'Usuario', 'Ubicacion'],
    });
    if (!compra) throw new NotFoundException('La compra no existe.');

    if (!forRegistrar) {
      const rolesNorm = (roles ?? []).map((r) => String(r).toLowerCase());
      const esAdmin = rolesNorm.includes('superadmin') || rolesNorm.includes('admin');
      const esPropia =
        usuarioId != null && Number(compra.UsuarioId) === Number(usuarioId);
      if (!esAdmin && !esPropia) {
        throw new ForbiddenException(
          'Solo puede consultar las ventas registradas por su usuario.',
        );
      }
    }

    return this.mapearDetalleCompleto(compra);
  }

  async obtenerNombreArchivoComprobante(
    id: number | string,
    usuarioId: number | null,
    roles: string[],
  ): Promise<string> {
    await this.obtenerDetalleAutorizado(id, usuarioId, roles);
    const compraId = Number(id);
    const compra = await this.comprasRepository.findOne({
      where: { Id: compraId },
    });
    const filename = String(compra?.ComprobanteArchivo || '').trim();
    if (!filename) {
      throw new NotFoundException('Esta compra no tiene comprobante adjunto.');
    }
    return filename;
  }

  private async descontarStockDeItems(
    manager: EntityManager,
    items: CompraItem[],
    compra: Compra,
  ): Promise<void> {
    const ubicacion = await this.resolverUbicacionStock(manager, compra);
    const { responsableId, responsableNombre } =
      await this.resolverResponsableCompra(manager, compra);

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
          UbicacionId: ubicacion.Id,
        },
        lock: { mode: 'pessimistic_write' },
      });
      const stockUbicacion = Number(balance?.Stock) || 0;
      if (stockUbicacion < cantidad) {
        throw new BadRequestException(
          `No hay stock suficiente de ${producto.Nombre} en ${ubicacion.Nombre}.`,
        );
      }

      if (!balance) {
        balance = manager.create(InventarioStockUbicacion, {
          ProductoId: String(producto.Id),
          UbicacionId: ubicacion.Id,
          Stock: stockUbicacion,
        });
      }
      balance.Stock = stockUbicacion - cantidad;
      await manager.save(balance);
      await this.sincronizarProductoSiCentral(manager, producto, ubicacion, balance.Stock);

      await insertarMovimientoInventario(manager, {
        tipo: TIPO_MOVIMIENTO.VENTA_WEB,
        productoId: String(producto.Id),
        cantidad,
        responsableId,
        responsableNombre,
        notas: `Venta web ${compra.Numero || `#${compra.Id}`} (${ubicacion.Nombre})`,
        ubicacionId: ubicacion.Id,
        ubicacionOrigenId: ubicacion.Id,
      });
    }
  }

  private async restaurarStockDeItems(
    manager: EntityManager,
    items: CompraItem[],
    compra: Compra,
  ): Promise<void> {
    const ubicacion = await this.resolverUbicacionStock(manager, compra);
    const { responsableId, responsableNombre } =
      await this.resolverResponsableCompra(manager, compra);

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
          UbicacionId: ubicacion.Id,
        },
        lock: { mode: 'pessimistic_write' },
      });
      const stockUbicacion = Number(balance?.Stock) || 0;
      if (!balance) {
        balance = manager.create(InventarioStockUbicacion, {
          ProductoId: String(producto.Id),
          UbicacionId: ubicacion.Id,
          Stock: stockUbicacion,
        });
      }
      balance.Stock = stockUbicacion + cantidad;
      await manager.save(balance);
      await this.sincronizarProductoSiCentral(manager, producto, ubicacion, balance.Stock, {
        restaurar: true,
      });

      await insertarMovimientoInventario(manager, {
        tipo: TIPO_MOVIMIENTO.ENTRADA,
        productoId: String(producto.Id),
        cantidad,
        responsableId,
        responsableNombre,
        notas: `Reverso de venta web ${compra.Numero || `#${compra.Id}`} (${ubicacion.Nombre})`,
        ubicacionId: ubicacion.Id,
        ubicacionDestinoId: ubicacion.Id,
      });
    }
  }

  private async sincronizarProductoSiCentral(
    manager: EntityManager,
    producto: Producto,
    ubicacion: InventarioUbicacion,
    stockUbicacion: number,
    opciones: { restaurar?: boolean } = {},
  ): Promise<void> {
    if (ubicacion.Codigo !== BODEGA_CENTRAL) return;
    producto.Stock = Math.max(0, stockUbicacion);
    if (producto.Stock <= 0) {
      producto.EsDestacado = false;
      producto.Disponible = false;
    } else if (opciones.restaurar) {
      producto.Disponible = true;
    }
    producto.AlertaStock = producto.Stock <= (producto.StockMinimo ?? 0);
    await manager.save(producto);
  }

  private tomarCampoBody(body: CompraBody, ...claves: string[]): unknown {
    if (!body) return '';
    for (const clave of claves) {
      const valor = body[clave];
      if (valor === undefined || valor === null || valor === '') continue;
      return Array.isArray(valor) ? valor[0] : valor;
    }
    return '';
  }

  private async resolverUbicacionStock(
    manager: EntityManager,
    compra: Compra,
  ): Promise<InventarioUbicacion> {
    const ubicacionId = Number(compra.UbicacionId);
    if (Number.isFinite(ubicacionId) && ubicacionId > 0) {
      const ubicacion = await manager.findOne(InventarioUbicacion, {
        where: { Id: ubicacionId },
      });
      if (!ubicacion) {
        throw new BadRequestException(
          'El punto de venta de esta compra ya no existe.',
        );
      }
      return ubicacion;
    }

    if (String(compra.ComprobanteArchivo || '').trim()) {
      throw new BadRequestException(
        'Esta compra no tiene un punto de venta asociado. No se puede ajustar el stock.',
      );
    }

    const central = await manager.findOne(InventarioUbicacion, {
      where: { Codigo: BODEGA_CENTRAL },
    });
    if (!central) {
      throw new BadRequestException('La Bodega Central no está inicializada.');
    }
    return central;
  }

  private async resolverUbicacionCliente(
    manager: EntityManager,
    body: CompraBody,
  ): Promise<InventarioUbicacion> {
    const idRaw = this.tomarCampoBody(
      body,
      'ubicacionId',
      'UbicacionId',
    );
    const codigoRaw = String(
      this.tomarCampoBody(
        body,
        'ubicacionCodigo',
        'UbicacionCodigo',
        'ubicacion',
        'Ubicacion',
      ) || '',
    )
      .trim()
      .toUpperCase();
    let ubicacion: InventarioUbicacion | null = null;
    const id = Number(idRaw);
    if (Number.isFinite(id) && id > 0) {
      ubicacion = await manager.findOne(InventarioUbicacion, { where: { Id: id } });
    }
    if (!ubicacion && codigoRaw) {
      ubicacion = await manager.findOne(InventarioUbicacion, {
        where: { Codigo: codigoRaw },
      });
    }
    if (!ubicacion || !esPuntoVentaCliente(ubicacion.Codigo)) {
      throw new BadRequestException('Seleccioná un punto de venta válido.');
    }
    if (ubicacion.Activo === false) {
      throw new BadRequestException(
        'El punto de venta seleccionado está inactivo.',
      );
    }
    return ubicacion;
  }

  private extraerItemsRaw(body: CompraBody): unknown[] {
    let raw: unknown = body?.items ?? body?.Items;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        throw new BadRequestException('Los productos de la compra no son válidos.');
      }
    }
    return Array.isArray(raw) ? raw : [];
  }

  private async resolverResponsableCompra(
    manager: EntityManager,
    compra: Compra,
  ): Promise<{ responsableId: number | null; responsableNombre: string }> {
    const responsableId = compra.UsuarioId ?? null;
    if (responsableId == null) {
      return { responsableId: null, responsableNombre: '' };
    }
    const usuario = await manager.findOne(Usuario, { where: { Id: responsableId } });
    return {
      responsableId,
      responsableNombre: usuario
        ? String(usuario.Nombre || usuario.Correo || `usuario:${responsableId}`).slice(0, 200)
        : `usuario:${responsableId}`,
    };
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
    const esGanada = estado === 'Entregado';
    const total = Number(compra.Total) || 0;
    const usuario = compra.Usuario;
    const vendedorNombre = String(usuario?.Nombre || usuario?.Correo || '').trim();
    const vendedorCorreo = String(usuario?.Correo || '').trim();
    return {
      id: Number(compra.Id),
      numero: compra.Numero,
      fecha: compra.Fecha?.toISOString?.() || String(compra.Fecha),
      usuarioId: compra.UsuarioId ? Number(compra.UsuarioId) : null,
      vendedorNombre,
      vendedorCorreo,
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
      ubicacionId: compra.UbicacionId ? Number(compra.UbicacionId) : null,
      ubicacionCodigo: compra.Ubicacion?.Codigo || null,
      ubicacionNombre: compra.Ubicacion?.Nombre || null,
      tieneComprobante: Boolean(String(compra.ComprobanteArchivo || '').trim()),
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
      cliente: null,
    };
  }

  private async mapearDetalleCompleto(compra: Compra): Promise<CompraDetalle> {
    const detalle = this.mapearDetalle(compra);
    const usuarioId = compra.UsuarioId ? Number(compra.UsuarioId) : null;
    if (!usuarioId) return detalle;
    const ficha = await this.clientesService.obtenerFichaPorUsuarioId(usuarioId);
    if (!ficha) return detalle;
    return {
      ...detalle,
      cliente: {
        tipo: ficha.TipoCliente || null,
        nombre: ficha.NombreLegal,
        apellidos: ficha.Apellidos,
        correo: compra.ClienteCorreo,
        telefono: ficha.Telefono,
        tipoDocumento: ficha.TipoDocumento,
        identificacion: ficha.Identificacion,
        razonSocial: ficha.RazonSocial,
        nombreComercial: ficha.NombreComercial,
        representanteLegal: ficha.RepresentanteLegal,
        cedulaJuridica: ficha.CedulaJuridica,
        direccionFiscal: ficha.DireccionFiscal,
        telefonoOficina: ficha.TelefonoOficina,
      },
    };
  }
}
