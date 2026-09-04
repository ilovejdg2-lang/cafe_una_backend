import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { basename } from 'path';
import { DataSource, In, Repository } from 'typeorm';
import { pickString } from '../common/body-fields';
import {
  insertarMovimientoInventario,
  TIPO_MOVIMIENTO,
} from '../common/movimiento-inventario.util';
import { DetalleSolicitud } from '../entities/detalle-solicitud.entity';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Proveedor } from '../entities/proveedor.entity';
import {
  HistorialEstadoSolicitud,
  SolicitudCompra,
} from '../entities/solicitud-compra.entity';
import { BODEGA_CENTRAL } from './inventario.service';
import { StockAlertaService } from './stock-alerta.service';

const ESTADOS = ['pendiente', 'aprobada', 'recibida'] as const;
type EstadoSolicitud = (typeof ESTADOS)[number];

const TRANSICIONES: Record<EstadoSolicitud, EstadoSolicitud | null> = {
  pendiente: 'aprobada',
  aprobada: 'recibida',
  recibida: null,
};

const ESTADO_HABILITADO = 'Habilitado';

export type ProveedorResponse = {
  id: number;
  nombre: string;
  correo: string;
  telefono: string;
  activo: boolean;
  creadoEn: string;
};

export type DetalleSolicitudResponse = {
  id: string;
  productoId: string;
  productoNombre: string | null;
  cantidadSolicitada: number;
};

export type SolicitudCompraResponse = {
  id: string;
  proveedorId: number;
  proveedorNombre: string | null;
  estado: string;
  fechaEstimadaEntrega: string | null;
  urlProformaPdf: string | null;
  notas: string;
  creadoPor: number | null;
  historialEstados: HistorialEstadoSolicitud[];
  creadoEn: string;
  actualizadoEn: string;
  detalles: DetalleSolicitudResponse[];
};

@Injectable()
export class SolicitudesCompraService {
  private readonly logger = new Logger(SolicitudesCompraService.name);

  constructor(
    @InjectRepository(SolicitudCompra)
    private readonly solicitudesRepo: Repository<SolicitudCompra>,
    @InjectRepository(DetalleSolicitud)
    private readonly detallesRepo: Repository<DetalleSolicitud>,
    @InjectRepository(Proveedor)
    private readonly proveedoresRepo: Repository<Proveedor>,
    @InjectRepository(Producto)
    private readonly productosRepo: Repository<Producto>,
    private readonly dataSource: DataSource,
    private readonly stockAlertaService: StockAlertaService,
  ) {}

  async listarProveedores(incluirInactivos = false): Promise<ProveedorResponse[]> {
    const where = incluirInactivos ? {} : { Activo: true };
    const rows = await this.proveedoresRepo.find({
      where,
      order: { Nombre: 'ASC' },
    });
    return rows.map((row) => this.mapearProveedor(row));
  }

  async crearProveedor(body: Record<string, unknown>): Promise<ProveedorResponse> {
    const nombre = pickString(body, 'nombre', 'Nombre').trim();
    if (!nombre || nombre.length > 200) {
      throw new BadRequestException(
        'El nombre del proveedor es obligatorio y debe tener máximo 200 caracteres.',
      );
    }
    const correo = pickString(body, 'correo', 'Correo').trim();
    if (correo.length > 150) {
      throw new BadRequestException('El correo no puede superar 150 caracteres.');
    }
    const telefono = pickString(body, 'telefono', 'Telefono').trim();
    if (telefono.length > 40) {
      throw new BadRequestException(
        'El teléfono no puede superar 40 caracteres.',
      );
    }

    const creado = await this.proveedoresRepo.save(
      this.proveedoresRepo.create({
        Nombre: nombre,
        Correo: correo,
        Telefono: telefono,
        Activo: true,
        CreadoEn: new Date(),
      }),
    );
    return this.mapearProveedor(creado);
  }

  async listar(filtros: {
    estado?: string;
    proveedorId?: string;
  }): Promise<SolicitudCompraResponse[]> {
    const qb = this.solicitudesRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.Proveedor', 'proveedor')
      .leftJoinAndSelect('s.Detalles', 'detalles')
      .orderBy('s.CreadoEn', 'DESC');

    const estado = (filtros.estado ?? '').trim().toLowerCase();
    if (estado) {
      if (!ESTADOS.includes(estado as EstadoSolicitud)) {
        throw new BadRequestException('El estado indicado no es válido.');
      }
      qb.andWhere('s.Estado = :estado', { estado });
    }

    const proveedorRaw = (filtros.proveedorId ?? '').trim();
    if (proveedorRaw) {
      if (!/^\d+$/.test(proveedorRaw)) {
        throw new BadRequestException(
          'El identificador del proveedor no es válido.',
        );
      }
      qb.andWhere('s.ProveedorId = :proveedorId', {
        proveedorId: Number(proveedorRaw),
      });
    }

    const rows = await qb.getMany();
    const productoIds = [
      ...new Set(
        rows.flatMap((s) => (s.Detalles ?? []).map((d) => String(d.ProductoId))),
      ),
    ];
    const productos = productoIds.length
      ? await this.productosRepo.find({ where: { Id: In(productoIds) } })
      : [];
    const nombres = new Map(
      productos.map((p) => [String(p.Id), p.Nombre] as const),
    );

    return rows.map((row) => this.mapearSolicitud(row, nombres));
  }

  async obtenerPorId(id: string): Promise<SolicitudCompraResponse> {
    const solicitud = await this.buscarSolicitud(id, true);
    const productoIds = (solicitud.Detalles ?? []).map((d) =>
      String(d.ProductoId),
    );
    const productos = productoIds.length
      ? await this.productosRepo.find({ where: { Id: In(productoIds) } })
      : [];
    const nombres = new Map(
      productos.map((p) => [String(p.Id), p.Nombre] as const),
    );
    return this.mapearSolicitud(solicitud, nombres);
  }

  /** Nombre de archivo en disco (no la URL pública mapeada). */
  async obtenerNombreArchivoProforma(id: string): Promise<string | null> {
    const solicitud = await this.buscarSolicitud(id, false);
    const raw = (solicitud.UrlProformaPdf ?? '').trim();
    if (!raw) return null;
    const name = basename(raw.split('?')[0]);
    if (!name || name === '.' || name === '..' || name === 'proforma') {
      return null;
    }
    return name;
  }

  async crear(
    body: Record<string, unknown>,
    creadoPor: number | null,
    urlProformaPdf?: string | null,
  ): Promise<SolicitudCompraResponse> {
    const proveedorId = this.validarProveedorId(
      this.tomarCampo(body, 'proveedorId', 'ProveedorId'),
    );
    const proveedor = await this.proveedoresRepo.findOne({
      where: { Id: proveedorId, Activo: true },
    });
    if (!proveedor) {
      throw new BadRequestException(
        'El proveedor no existe o está inactivo.',
      );
    }

    const detalles = this.validarDetalles(
      this.tomarCampo(body, 'detalles', 'Detalles'),
    );
    const productoIds = detalles.map((d) => d.productoId);
    const productos = await this.productosRepo.find({
      where: { Id: In(productoIds) },
    });
    if (productos.length !== productoIds.length) {
      throw new BadRequestException(
        'Uno o más productos de la solicitud no existen.',
      );
    }

    const notas = this.validarNotas(
      this.tomarCampo(body, 'notas', 'Notas'),
    );
    const fechaEstimada = this.validarFechaEstimada(
      this.tomarCampo(
        body,
        'fechaEstimadaEntrega',
        'FechaEstimadaEntrega',
      ),
    );
    const urlBody = pickString(body, 'urlProformaPdf', 'UrlProformaPdf').trim();
    // Solo el filename que subió multer; no confiar URLs del cliente.
    const urlFinal = urlProformaPdf?.trim() || null;
    if (urlBody && !urlFinal) {
      throw new BadRequestException(
        'La proforma debe enviarse como archivo PDF adjunto.',
      );
    }
    if (urlFinal && urlFinal.length > 1000) {
      throw new BadRequestException(
        'La URL de la proforma no puede superar 1000 caracteres.',
      );
    }

    const ahora = new Date();
    const historial: HistorialEstadoSolicitud[] = [
      {
        estado: 'pendiente',
        fecha: ahora.toISOString(),
        usuarioId: creadoPor,
      },
    ];

    const guardada = await this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.save(
        manager.create(SolicitudCompra, {
          ProveedorId: proveedorId,
          Estado: 'pendiente',
          FechaEstimadaEntrega: fechaEstimada,
          UrlProformaPdf: urlFinal,
          Notas: notas,
          CreadoPor: creadoPor,
          HistorialEstados: historial,
          CreadoEn: ahora,
          ActualizadoEn: ahora,
        }),
      );

      for (const detalle of detalles) {
        await manager.save(
          manager.create(DetalleSolicitud, {
            SolicitudId: String(solicitud.Id),
            ProductoId: detalle.productoId,
            CantidadSolicitada: detalle.cantidadSolicitada.toFixed(2),
          }),
        );
      }

      return solicitud;
    });

    return this.obtenerPorId(String(guardada.Id));
  }

  async cambiarEstado(
    id: string,
    body: Record<string, unknown>,
    usuarioId: number | null,
  ): Promise<SolicitudCompraResponse> {
    const nuevoEstadoRaw = String(
      this.tomarCampo(body, 'estado', 'Estado') ?? '',
    )
      .trim()
      .toLowerCase();
    if (!ESTADOS.includes(nuevoEstadoRaw as EstadoSolicitud)) {
      throw new BadRequestException('El estado indicado no es válido.');
    }
    const nuevoEstado = nuevoEstadoRaw as EstadoSolicitud;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const productosAfectados: string[] = [];

    try {
      const solicitud = await queryRunner.manager.findOne(SolicitudCompra, {
        where: { Id: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!solicitud) {
        throw new NotFoundException('La solicitud de compra no existe.');
      }

      const actual = solicitud.Estado as EstadoSolicitud;
      if (actual === nuevoEstado) {
        throw new BadRequestException(
          'La solicitud ya se encuentra en ese estado.',
        );
      }
      if (TRANSICIONES[actual] !== nuevoEstado) {
        throw new BadRequestException(
          `No se puede pasar de "${actual}" a "${nuevoEstado}". Solo se permite avanzar: pendiente → aprobada → recibida.`,
        );
      }

      if (nuevoEstado === 'recibida') {
        const detalles = await queryRunner.manager.find(DetalleSolicitud, {
          where: { SolicitudId: String(solicitud.Id) },
        });
        const central = await queryRunner.manager.findOne(InventarioUbicacion, {
          where: { Codigo: BODEGA_CENTRAL },
        });
        if (!central) {
          throw new NotFoundException(
            'La ubicación de Bodega Central no está inicializada.',
          );
        }

        for (const detalle of detalles) {
          const producto = await queryRunner.manager.findOne(Producto, {
            where: { Id: String(detalle.ProductoId) },
            lock: { mode: 'pessimistic_write' },
          });

          if (!producto) {
            throw new BadRequestException(
              `El producto ${detalle.ProductoId} de la solicitud ya no existe. No se puede marcar como recibida.`,
            );
          }

          if (!this.productoActivo(producto)) {
            throw new BadRequestException(
              `El producto ${producto.Nombre} está deshabilitado. Reactivalo o ajustá la solicitud antes de recibirla.`,
            );
          }

          const cantidadEntera = this.cantidadParaStock(
            detalle.CantidadSolicitada,
          );
          if (cantidadEntera <= 0) {
            throw new BadRequestException(
              `La cantidad del producto ${producto.Nombre} no es un entero válido.`,
            );
          }

          let balance = await queryRunner.manager.findOne(
            InventarioStockUbicacion,
            {
              where: {
                ProductoId: String(producto.Id),
                UbicacionId: central.Id,
              },
              lock: { mode: 'pessimistic_write' },
            },
          );
          if (!balance) {
            balance = queryRunner.manager.create(InventarioStockUbicacion, {
              ProductoId: String(producto.Id),
              UbicacionId: central.Id,
              Stock: 0,
            });
          }

          const stockAnterior = Number(balance.Stock) || 0;
          balance.Stock = stockAnterior + cantidadEntera;
          producto.Stock = balance.Stock;
          if (producto.Stock > 0) producto.Disponible = true;

          await queryRunner.manager.save(balance);
          await queryRunner.manager.save(producto);

          const notaEntrada = `Entrada por solicitud #${solicitud.Id}`;
          await insertarMovimientoInventario(queryRunner.manager, {
            tipo: TIPO_MOVIMIENTO.ENTRADA,
            productoId: String(producto.Id),
            cantidad: cantidadEntera,
            responsableId: usuarioId,
            responsableNombre: `usuario:${usuarioId}`,
            notas: notaEntrada,
            solicitudId: String(solicitud.Id),
            ubicacionId: central.Id,
            ubicacionDestinoId: central.Id,
            fecha: new Date(),
          });

          productosAfectados.push(String(producto.Id));
        }
      }

      const historial = Array.isArray(solicitud.HistorialEstados)
        ? [...solicitud.HistorialEstados]
        : [];
      historial.push({
        estado: nuevoEstado,
        fecha: new Date().toISOString(),
        usuarioId,
      });

      solicitud.Estado = nuevoEstado;
      solicitud.HistorialEstados = historial;
      solicitud.ActualizadoEn = new Date();
      await queryRunner.manager.save(solicitud);

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }

    for (const productoId of productosAfectados) {
      try {
        await this.stockAlertaService.verificarTrasMovimiento(productoId);
      } catch (error) {
        this.logger.warn(
          `No se pudo verificar alerta de stock del producto ${productoId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.obtenerPorId(id);
  }

  private productoActivo(producto: Producto): boolean {
    const estado = (producto.Estado ?? '').trim().toLowerCase();
    return estado === ESTADO_HABILITADO.toLowerCase();
  }

  private cantidadParaStock(cantidad: string | number): number {
    const n = typeof cantidad === 'number' ? cantidad : Number(cantidad);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (!Number.isInteger(n)) return 0;
    return n;
  }

  private async buscarSolicitud(
    id: string,
    conRelaciones: boolean,
  ): Promise<SolicitudCompra> {
    if (!/^\d+$/.test(String(id))) {
      throw new BadRequestException(
        'El identificador de la solicitud no es válido.',
      );
    }
    const solicitud = await this.solicitudesRepo.findOne({
      where: { Id: id },
      relations: conRelaciones ? ['Proveedor', 'Detalles'] : undefined,
    });
    if (!solicitud) {
      throw new NotFoundException('La solicitud de compra no existe.');
    }
    return solicitud;
  }

  private validarProveedorId(value: unknown): number {
    const raw =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value.trim())
          : NaN;
    if (!Number.isInteger(raw) || raw <= 0) {
      throw new BadRequestException(
        'El identificador del proveedor no es válido.',
      );
    }
    return raw;
  }

  private validarDetalles(
    value: unknown,
  ): Array<{ productoId: string; cantidadSolicitada: number }> {
    let parsed = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new BadRequestException(
          'Los detalles de la solicitud no son un JSON válido.',
        );
      }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new BadRequestException(
        'La solicitud debe incluir al menos un detalle.',
      );
    }

    const vistos = new Set<string>();
    const detalles: Array<{ productoId: string; cantidadSolicitada: number }> =
      [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(
          'Cada detalle debe ser un objeto con producto y cantidad.',
        );
      }
      const row = item as Record<string, unknown>;
      const productoRaw = this.tomarCampo(row, 'productoId', 'ProductoId');
      const productoId =
        typeof productoRaw === 'number' && Number.isInteger(productoRaw)
          ? String(productoRaw)
          : typeof productoRaw === 'string'
            ? productoRaw.trim()
            : '';
      if (!/^\d+$/.test(productoId) || BigInt(productoId) <= 0n) {
        throw new BadRequestException(
          'El identificador del producto en un detalle no es válido.',
        );
      }
      if (vistos.has(productoId)) {
        throw new BadRequestException(
          'No se permiten productos duplicados en los detalles.',
        );
      }
      vistos.add(productoId);

      const cantidadRaw = this.tomarCampo(
        row,
        'cantidadSolicitada',
        'CantidadSolicitada',
      );
      const cantidad =
        typeof cantidadRaw === 'number'
          ? cantidadRaw
          : typeof cantidadRaw === 'string'
            ? Number(cantidadRaw.trim())
            : NaN;
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new BadRequestException(
          'La cantidad solicitada debe ser mayor a 0.',
        );
      }
      if (!Number.isInteger(cantidad)) {
        throw new BadRequestException(
          'La cantidad solicitada debe ser un número entero.',
        );
      }
      if (cantidad > 999999999) {
        throw new BadRequestException(
          'La cantidad solicitada supera el máximo permitido.',
        );
      }

      detalles.push({
        productoId,
        cantidadSolicitada: cantidad,
      });
    }

    return detalles;
  }

  private validarNotas(value: unknown): string {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string') {
      throw new BadRequestException('Las notas no son válidas.');
    }
    const notas = value.trim();
    if (notas.length > 1000) {
      throw new BadRequestException(
        'Las notas no pueden superar 1000 caracteres.',
      );
    }
    return notas;
  }

  private validarFechaEstimada(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'La fecha estimada de entrega no es válida.',
      );
    }
    const fecha = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException(
        'La fecha estimada de entrega debe tener formato YYYY-MM-DD.',
      );
    }
    const parsed = new Date(`${fecha}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        'La fecha estimada de entrega no es válida.',
      );
    }
    return fecha;
  }

  private tomarCampo(
    body: Record<string, unknown>,
    ...keys: string[]
  ): unknown {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(body ?? {}, key)) {
        return body[key];
      }
    }
    return undefined;
  }

  private mapearProveedor(row: Proveedor): ProveedorResponse {
    return {
      id: row.Id,
      nombre: row.Nombre,
      correo: row.Correo ?? '',
      telefono: row.Telefono ?? '',
      activo: row.Activo !== false,
      creadoEn:
        row.CreadoEn instanceof Date
          ? row.CreadoEn.toISOString()
          : String(row.CreadoEn ?? ''),
    };
  }

  private mapearSolicitud(
    row: SolicitudCompra,
    nombresProductos: Map<string, string>,
  ): SolicitudCompraResponse {
    return {
      id: String(row.Id),
      proveedorId: row.ProveedorId,
      proveedorNombre: row.Proveedor?.Nombre ?? null,
      estado: row.Estado,
      fechaEstimadaEntrega: row.FechaEstimadaEntrega
        ? String(row.FechaEstimadaEntrega).slice(0, 10)
        : null,
      urlProformaPdf: row.UrlProformaPdf
        ? `/api/solicitudes-compra/${row.Id}/proforma`
        : null,
      notas: row.Notas ?? '',
      creadoPor: row.CreadoPor,
      historialEstados: Array.isArray(row.HistorialEstados)
        ? row.HistorialEstados
        : [],
      creadoEn:
        row.CreadoEn instanceof Date
          ? row.CreadoEn.toISOString()
          : String(row.CreadoEn ?? ''),
      actualizadoEn:
        row.ActualizadoEn instanceof Date
          ? row.ActualizadoEn.toISOString()
          : String(row.ActualizadoEn ?? ''),
      detalles: (row.Detalles ?? []).map((d) => ({
        id: String(d.Id),
        productoId: String(d.ProductoId),
        productoNombre: nombresProductos.get(String(d.ProductoId)) ?? null,
        cantidadSolicitada: Number(d.CantidadSolicitada) || 0,
      })),
    };
  }
}
