import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { esRolSuperAdmin } from '../common/roles.util';
import { TIPO_MOVIMIENTO } from '../common/movimiento-inventario.util';
import {
  AuditoriaSolicitudSalidaInventario,
  ESTADOS_SOLICITUD_SALIDA,
  InventarioStockUbicacion,
  InventarioUbicacion,
  MovimientoInventario,
  MotivoSalida,
  Notificacion,
  Producto,
  SolicitudSalidaInventario,
  SolicitudSalidaInventarioItem,
  Usuario,
} from '../entities';
import { StockAlertaService } from './stock-alerta.service';

const ESTADO = ESTADOS_SOLICITUD_SALIDA;
const BODEGA_CENTRAL = 'BODEGA_CENTRAL';

export type ItemSolicitudSalidaInput = {
  productoId?: unknown;
  cantidad?: unknown;
};

export type CrearSolicitudSalidaInput = {
  tipo?: unknown;
  fechaSalida?: unknown;
  destinatario?: unknown;
  responsable?: unknown;
  items?: unknown;
};

type ItemNormalizado = { productoId: string; cantidad: number };

@Injectable()
export class SolicitudesSalidaInventarioService {
  private readonly logger = new Logger(SolicitudesSalidaInventarioService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly stockAlertaService: StockAlertaService,
  ) {}

  async crearSolicitud(
    input: CrearSolicitudSalidaInput,
    solicitanteId: number,
  ): Promise<SolicitudSalidaInventario> {
    const datos = this.validarEntrada(input, solicitanteId);

    const solicitud = await this.dataSource.transaction(async (manager) => {
      const ubicaciones = manager.getRepository(InventarioUbicacion);
      const stocks = manager.getRepository(InventarioStockUbicacion);
      const productos = manager.getRepository(Producto);
      const motivos = manager.getRepository(MotivoSalida);
      const solicitudes = manager.getRepository(SolicitudSalidaInventario);
      const itemsRepo = manager.getRepository(SolicitudSalidaInventarioItem);
      const auditoria = manager.getRepository(
        AuditoriaSolicitudSalidaInventario,
      );
      const central = await ubicaciones.findOne({
        where: { Codigo: BODEGA_CENTRAL },
      });
      if (!central) throw new NotFoundException('No existe la Bodega Central.');

      const nombreMotivo = datos.tipo === 'donacion' ? 'Donación' : 'Regalía';
      const motivo = await motivos.findOne({ where: { Nombre: nombreMotivo } });
      if (!motivo)
        throw new NotFoundException(`No existe el motivo ${nombreMotivo}.`);

      const reservas = [];
      for (const item of datos.items) {
        const producto = await productos.findOne({
          where: { Id: item.productoId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!producto) {
          throw new NotFoundException(
            `No existe el producto ${item.productoId}.`,
          );
        }
        const balance = await stocks.findOne({
          where: { ProductoId: item.productoId, UbicacionId: central.Id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!balance) {
          throw new BadRequestException(
            `El producto ${item.productoId} no tiene stock en Bodega Central.`,
          );
        }
        const fisico = Math.max(0, Number(balance.Stock) || 0);
        const reservado = Math.max(0, Number(balance.StockReservado) || 0);
        const disponible = fisico - reservado;
        if (disponible < item.cantidad) {
          throw new ConflictException(
            `Stock disponible insuficiente para el producto ${item.productoId}.`,
          );
        }
        reservas.push({ item, balance, reservado });
      }

      for (const { item, balance, reservado } of reservas) {
        balance.StockReservado = reservado + item.cantidad;
        await stocks.save(balance);
      }

      const solicitud = await solicitudes.save(
        solicitudes.create({
          Tipo: datos.tipo,
          Estado: ESTADO.PENDIENTE,
          FechaSalida: datos.fechaSalida,
          MotivoSalidaId: motivo.Id,
          Destinatario: datos.destinatario,
          ResponsableNombre: datos.responsable,
          SolicitanteId: solicitanteId,
          RevisorId: null,
          FechaRevision: null,
          ComentarioRevision: null,
        }),
      );

      for (const item of datos.items) {
        await itemsRepo.save(
          itemsRepo.create({
            SolicitudId: solicitud.Id,
            ProductoId: item.productoId,
            Cantidad: item.cantidad,
          }),
        );
      }

      await auditoria.save(
        auditoria.create({
          SolicitudId: solicitud.Id,
          Accion: 'solicitada',
          EstadoAnterior: null,
          EstadoNuevo: ESTADO.PENDIENTE,
          ActorId: solicitanteId,
          Comentario: null,
        }),
      );
      return solicitud;
    });
    await this.notificarNuevaSolicitud(solicitud);
    return solicitud;
  }

  async listarSolicitudes(
    actorId: number,
    roles: string[],
    estado?: string,
  ): Promise<SolicitudSalidaInventario[]> {
    const solicitudes = this.dataSource.getRepository(
      SolicitudSalidaInventario,
    );
    const where: Record<string, unknown> = esRolSuperAdminIn(roles)
      ? {}
      : { SolicitanteId: actorId };
    if (estado && Object.values(ESTADO).includes(estado as never)) {
      where.Estado = estado;
    }
    return solicitudes.find({
      where,
      relations: { Items: { Producto: true }, Historial: true },
      order: { CreadaEn: 'DESC' },
    });
  }

  async obtenerSolicitud(
    id: string,
    actorId: number,
    roles: string[],
  ): Promise<SolicitudSalidaInventario> {
    const solicitud = await this.dataSource
      .getRepository(SolicitudSalidaInventario)
      .findOne({
        where: { Id: id },
        relations: { Items: { Producto: true }, Historial: true },
      });
    if (!solicitud)
      throw new NotFoundException('No existe la solicitud de salida.');
    if (!esRolSuperAdminIn(roles) && solicitud.SolicitanteId !== actorId) {
      throw new ForbiddenException('No puede consultar esta solicitud.');
    }
    return solicitud;
  }

  async aprobarSolicitud(
    id: string,
    actorId: number,
    roles: string[],
    comentario?: string,
  ): Promise<SolicitudSalidaInventario> {
    this.exigirSuperAdmin(roles);
    return this.cambiarEstado(id, actorId, ESTADO.APROBADA, comentario);
  }

  async rechazarSolicitud(
    id: string,
    actorId: number,
    roles: string[],
    comentario: string,
  ): Promise<SolicitudSalidaInventario> {
    this.exigirSuperAdmin(roles);
    return this.cambiarEstado(id, actorId, ESTADO.RECHAZADA, comentario);
  }

  async cancelarSolicitud(
    id: string,
    actorId: number,
    roles: string[],
    comentario: string,
  ): Promise<SolicitudSalidaInventario> {
    this.exigirSuperAdmin(roles);
    return this.cambiarEstado(id, actorId, ESTADO.CANCELADA, comentario);
  }

  private exigirSuperAdmin(roles: string[]): void {
    if (!esRolSuperAdminIn(roles)) {
      throw new ForbiddenException(
        'Solo SuperAdmin puede revisar o cancelar solicitudes de salida.',
      );
    }
  }

  private async cambiarEstado(
    id: string,
    actorId: number,
    nuevoEstado: string,
    comentario?: string,
  ): Promise<SolicitudSalidaInventario> {
    if (
      !/^\d+$/.test(String(id)) ||
      !Number.isInteger(actorId) ||
      actorId <= 0
    ) {
      throw new BadRequestException('La solicitud o el actor no son válidos.');
    }
    const nota = String(comentario ?? '').trim();
    if (nuevoEstado !== ESTADO.APROBADA && !nota) {
      throw new BadRequestException(
        'El motivo de rechazo o cancelación es obligatorio.',
      );
    }
    if (nota.length > 500) {
      throw new BadRequestException(
        'El comentario no puede superar 500 caracteres.',
      );
    }

    const resultado = await this.dataSource.transaction(async (manager) => {
      const solicitudes = manager.getRepository(SolicitudSalidaInventario);
      const solicitud = await solicitudes.findOne({
        where: { Id: String(id) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!solicitud)
        throw new NotFoundException('No existe la solicitud de salida.');
      if (solicitud.Estado === nuevoEstado) {
        const items =
          nuevoEstado === ESTADO.APROBADA
            ? await manager
                .getRepository(SolicitudSalidaInventarioItem)
                .find({ where: { SolicitudId: String(id) } })
            : [];
        return {
          solicitud,
          productosARecalcular: [
            ...new Set(items.map((item) => String(item.ProductoId))),
          ],
        };
      }
      if (solicitud.Estado !== ESTADO.PENDIENTE) {
        throw new ConflictException('La solicitud ya fue revisada.');
      }

      const ubicaciones = manager.getRepository(InventarioUbicacion);
      const stocks = manager.getRepository(InventarioStockUbicacion);
      const productos = manager.getRepository(Producto);
      const itemsRepo = manager.getRepository(SolicitudSalidaInventarioItem);
      const movimientos = manager.getRepository(MovimientoInventario);
      const auditoria = manager.getRepository(
        AuditoriaSolicitudSalidaInventario,
      );
      const central = await ubicaciones.findOne({
        where: { Codigo: BODEGA_CENTRAL },
      });
      if (!central) throw new NotFoundException('No existe la Bodega Central.');
      const items = await itemsRepo.find({
        where: { SolicitudId: String(id) },
        order: { ProductoId: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (items.length === 0) {
        throw new ConflictException('La solicitud no contiene productos.');
      }

      const lineasValidadas = [];
      for (const item of items) {
        const producto =
          nuevoEstado === ESTADO.APROBADA
            ? await productos.findOne({
                where: { Id: item.ProductoId },
                lock: { mode: 'pessimistic_write' },
              })
            : null;
        if (nuevoEstado === ESTADO.APROBADA && !producto) {
          throw new NotFoundException(
            `No existe el producto ${item.ProductoId}.`,
          );
        }
        const balance = await stocks.findOne({
          where: { ProductoId: item.ProductoId, UbicacionId: central.Id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !balance ||
          Number(balance.Stock) < item.Cantidad ||
          Number(balance.StockReservado) < item.Cantidad
        ) {
          throw new ConflictException(
            `No se puede completar la solicitud por un balance inválido del producto ${item.ProductoId}.`,
          );
        }
        lineasValidadas.push({ item, producto, balance });
      }

      for (const { item, producto, balance } of lineasValidadas) {
        balance.StockReservado = Number(balance.StockReservado) - item.Cantidad;
        if (nuevoEstado === ESTADO.APROBADA) {
          if (!producto) {
            throw new NotFoundException(
              `No existe el producto ${item.ProductoId}.`,
            );
          }
          balance.Stock = Number(balance.Stock) - item.Cantidad;
          producto.Stock = balance.Stock;
          await productos.save(producto);
          await movimientos.save(
            movimientos.create({
              Tipo: TIPO_MOVIMIENTO.SALIDA_BODEGA,
              ProductoId: item.ProductoId,
              Cantidad: item.Cantidad,
              MotivoSalidaId: solicitud.MotivoSalidaId,
              Destinatario: solicitud.Destinatario,
              ResponsableNombre: solicitud.ResponsableNombre,
              ResponsableId: actorId,
              Observaciones: nota,
              Notas: nota,
              SolicitudSalidaId: solicitud.Id,
              UbicacionId: central.Id,
              UbicacionOrigenId: central.Id,
              UbicacionDestinoId: null,
              Fecha: new Date(),
            }),
          );
        }
        await stocks.save(balance);
      }

      solicitud.Estado = nuevoEstado;
      solicitud.RevisorId = actorId;
      solicitud.FechaRevision = new Date();
      solicitud.ComentarioRevision = nota || null;
      await solicitudes.save(solicitud);
      await auditoria.save(
        auditoria.create({
          SolicitudId: solicitud.Id,
          Accion: nuevoEstado,
          EstadoAnterior: ESTADO.PENDIENTE,
          EstadoNuevo: nuevoEstado,
          ActorId: actorId,
          Comentario: nota || null,
        }),
      );
      return {
        solicitud,
        productosARecalcular:
          nuevoEstado === ESTADO.APROBADA
            ? [...new Set(items.map((item) => String(item.ProductoId)))]
            : [],
      };
    });
    const solicitudActualizada = resultado.solicitud;
    for (const productId of resultado.productosARecalcular) {
      try {
        await this.stockAlertaService.verificarTrasMovimiento(productId);
      } catch (error) {
        this.logger.error(
          `No se pudieron actualizar las alertas de stock del producto ${productId} después de aprobar la solicitud ${solicitudActualizada.Id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    await this.notificarCambio(solicitudActualizada, nuevoEstado);
    return solicitudActualizada;
  }

  private async notificarNuevaSolicitud(
    solicitud: SolicitudSalidaInventario,
  ): Promise<void> {
    try {
      const usuarios = await this.dataSource.getRepository(Usuario).find({
        where: { Estado: 'activo' },
        select: ['Id', 'Roles'],
      });
      const receptores = usuarios.filter((usuario) =>
        esRolSuperAdminIn(usuario.Roles),
      );
      await this.insertarNotificaciones(
        receptores.map((usuario) => ({
          UsuarioId: usuario.Id,
          Tipo: 'salida_solicitud',
          Titulo: 'Nueva solicitud de salida de inventario',
          Mensaje: `Una solicitud de ${solicitud.Tipo} requiere revisión.`,
          Enlace: this.enlaceSolicitud(solicitud.Id),
          Leida: false,
          ClaveUnica: `salida-inventario:${solicitud.Id}:solicitada:${usuario.Id}`,
          ReferenciaId: String(solicitud.Id),
        })),
        solicitud.Id,
      );
    } catch (error) {
      this.registrarFalloNotificacion(solicitud.Id, error);
    }
  }

  private async notificarCambio(
    solicitud: SolicitudSalidaInventario,
    estado: string,
  ): Promise<void> {
    const etiqueta = {
      [ESTADO.APROBADA]: 'aprobada',
      [ESTADO.RECHAZADA]: 'rechazada',
      [ESTADO.CANCELADA]: 'cancelada',
    }[estado];
    if (!etiqueta) return;
    try {
      await this.insertarNotificaciones(
        [
          {
            UsuarioId: solicitud.SolicitanteId,
            Tipo: 'salida_estado',
            Titulo: `Solicitud de salida ${etiqueta}`,
            Mensaje: `Tu solicitud de salida de inventario fue ${etiqueta}.`,
            Enlace: this.enlaceSolicitud(solicitud.Id),
            Leida: false,
            ClaveUnica: `salida-inventario:${solicitud.Id}:${estado}:${solicitud.SolicitanteId}`,
            ReferenciaId: String(solicitud.Id),
          },
        ],
        solicitud.Id,
      );
    } catch (error) {
      this.registrarFalloNotificacion(solicitud.Id, error);
    }
  }

  private async insertarNotificaciones(
    notificaciones: Array<Omit<Notificacion, 'Id' | 'CreadoEn'>>,
    solicitudId: string,
  ): Promise<void> {
    if (notificaciones.length === 0) return;
    try {
      await this.dataSource
        .getRepository(Notificacion)
        .createQueryBuilder()
        .insert()
        .into(Notificacion)
        .values(notificaciones)
        .orIgnore()
        .execute();
    } catch (error) {
      this.registrarFalloNotificacion(solicitudId, error);
    }
  }

  private enlaceSolicitud(id: string): string {
    return `/admin/salidas-inventario#solicitud-${id}`;
  }

  private registrarFalloNotificacion(id: string, error: unknown): void {
    this.logger.warn(
      `No se pudo notificar la solicitud de salida ${id}: ${String(error)}`,
    );
  }

  private validarEntrada(
    input: CrearSolicitudSalidaInput,
    solicitanteId: number,
  ): {
    tipo: 'donacion' | 'regalia';
    fechaSalida: string;
    destinatario: string;
    responsable: string;
    items: ItemNormalizado[];
  } {
    const tipo =
      typeof input?.tipo === 'string' ? input.tipo.trim().toLowerCase() : '';
    if (tipo !== 'donacion' && tipo !== 'regalia') {
      throw new BadRequestException(
        'El tipo de salida debe ser donacion o regalia.',
      );
    }
    const fechaSalida =
      typeof input?.fechaSalida === 'string' ? input.fechaSalida.trim() : '';
    const fechaParseada = new Date(`${fechaSalida}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fechaSalida) ||
      Number.isNaN(fechaParseada.getTime()) ||
      fechaParseada.toISOString().slice(0, 10) !== fechaSalida
    ) {
      throw new BadRequestException(
        'La fecha de salida debe tener formato YYYY-MM-DD.',
      );
    }
    const destinatario =
      typeof input?.destinatario === 'string' ? input.destinatario.trim() : '';
    const responsable =
      typeof input?.responsable === 'string' ? input.responsable.trim() : '';
    if (!destinatario || destinatario.length > 200) {
      throw new BadRequestException(
        'El destinatario es obligatorio y no puede superar 200 caracteres.',
      );
    }
    if (!responsable || responsable.length > 200) {
      throw new BadRequestException(
        'El responsable es obligatorio y no puede superar 200 caracteres.',
      );
    }
    if (!Number.isInteger(solicitanteId) || solicitanteId <= 0) {
      throw new BadRequestException('El solicitante no es válido.');
    }
    if (!Array.isArray(input?.items) || input.items.length === 0) {
      throw new BadRequestException(
        'La solicitud debe incluir al menos un producto.',
      );
    }

    const items = (input.items as ItemSolicitudSalidaInput[]).map((item) => {
      const productoIdInput = item?.productoId;
      const productoId =
        typeof productoIdInput === 'string' ||
        typeof productoIdInput === 'number'
          ? String(productoIdInput).trim()
          : '';
      const cantidad = Number(item?.cantidad);
      if (
        !/^\d+$/.test(productoId) ||
        !Number.isSafeInteger(cantidad) ||
        cantidad <= 0
      ) {
        throw new BadRequestException(
          'Cada producto debe tener un identificador y cantidad entera positiva.',
        );
      }
      return { productoId, cantidad };
    });
    if (new Set(items.map((item) => item.productoId)).size !== items.length) {
      throw new BadRequestException(
        'Cada producto puede aparecer una sola vez en la solicitud.',
      );
    }
    items.sort((a, b) =>
      a.productoId.localeCompare(b.productoId, 'en', { numeric: true }),
    );
    return { tipo, fechaSalida, destinatario, responsable, items };
  }
}

function esRolSuperAdminIn(roles: string[] | null | undefined): boolean {
  return (roles ?? []).some((role) => esRolSuperAdmin(role));
}
