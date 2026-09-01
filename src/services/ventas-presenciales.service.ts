import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EmailService } from '../common/email.service';
import { Compra } from '../entities/compra.entity';
import { CompraItem } from '../entities/compra-item.entity';
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

export type VentaPresencialItem = {
  productoId: string;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  stockRestante: number;
  movimientoId?: string;
};

export type VentaPresencialResponse = {
  id: string;
  numero?: string;
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
  responsableNombre?: string;
  clienteNombre?: string;
  clienteCorreo?: string;
  metodoPago?: string;
  total?: number;
  items?: VentaPresencialItem[];
  correoEnviado?: boolean;
};

@Injectable()
export class VentasPresencialesService {
  constructor(
    @InjectRepository(InventarioUbicacion)
    private readonly ubicacionesRepo: Repository<InventarioUbicacion>,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
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
    const ubicacionRaw =
      body.ubicacionId ??
      body.UbicacionId ??
      body.ubicacion_id ??
      body.ubicacionCodigo ??
      body.UbicacionCodigo ??
      body.ubicacion ??
      '';

    const fechaRaw = String(body.fecha ?? body.Fecha ?? '').trim();
    const fecha = fechaRaw ? new Date(fechaRaw) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha indicada no es válida.');
    }

    const notas = String(body.notas ?? body.Notas ?? '')
      .trim()
      .slice(0, 500);

    const clienteNombre = String(
      body.clienteNombre ?? body.ClienteNombre ?? body.cliente ?? '',
    ).trim();

    const clienteCorreo = String(
      body.clienteCorreo ?? body.ClienteCorreo ?? body.correo ?? '',
    ).trim();

    const metodoPago = String(
      body.metodoPago ?? body.MetodoPago ?? 'Efectivo',
    ).trim() || 'Efectivo';

    const enviarCorreo = Boolean(body.enviarCorreo ?? body.EnviarCorreo);

    // Determinar si es solicitud multi-ítem o unitaria
    const itemsRaw = Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : null;

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

      let responsableNombre = '';
      if (responsableId != null) {
        const usuario = await queryRunner.manager.findOne(Usuario, {
          where: { Id: responsableId },
        });
        responsableNombre = usuario
          ? String(usuario.Nombre || usuario.Correo || `usuario:${responsableId}`).slice(0, 200)
          : `usuario:${responsableId}`;
      }

      const itemsCalculados: VentaPresencialItem[] = [];
      let totalVenta = 0;

      if (itemsRaw && itemsRaw.length > 0) {
        // Venta multi-ítem (Carrito de compras)
        for (const item of itemsRaw) {
          const pId = String(item.productoId ?? item.ProductoId ?? item.id ?? '').trim();
          if (!pId || !/^\d+$/.test(pId)) {
            throw new BadRequestException('Cada producto debe tener un identificador válido.');
          }
          const cant = Number(item.cantidad ?? item.Cantidad ?? 0);
          if (!Number.isInteger(cant) || cant <= 0) {
            throw new BadRequestException('La cantidad de cada producto debe ser un entero positivo.');
          }

          const producto = await queryRunner.manager.findOne(Producto, {
            where: { Id: pId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!producto) {
            throw new NotFoundException(`El producto #${pId} no existe.`);
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
          if (disponible < cant) {
            throw new BadRequestException(
              `Stock insuficiente para "${producto.Nombre}" en este punto. Disponible: ${disponible} unid.`,
            );
          }

          if (!balance) {
            balance = queryRunner.manager.create(InventarioStockUbicacion, {
              ProductoId: String(producto.Id),
              UbicacionId: ubicacion.Id,
              Stock: disponible,
            });
          }
          balance.Stock = disponible - cant;
          await queryRunner.manager.save(balance);

          const precioUnitario = Number(item.precioUnitario ?? producto.PrecioConIVA ?? producto.PrecioNormal) || 0;
          const subtotalItem = Math.round(precioUnitario * cant);
          totalVenta += subtotalItem;

          const mov = await queryRunner.manager.save(
            queryRunner.manager.create(MovimientoInventario, {
              Tipo: TIPO_VENTA_PRESENCIAL,
              ProductoId: String(producto.Id),
              Cantidad: cant,
              ResponsableNombre: responsableNombre,
              ResponsableId: responsableId,
              Observaciones: notas,
              Notas: notas,
              SolicitudId: null,
              UbicacionId: ubicacion.Id,
              Fecha: fecha,
            }),
          );

          itemsCalculados.push({
            productoId: String(producto.Id),
            productoNombre: producto.Nombre,
            cantidad: cant,
            precioUnitario,
            subtotal: subtotalItem,
            stockRestante: balance.Stock,
            movimientoId: String(mov.Id),
          });
        }
      } else {
        // Venta unitaria legacy
        const productoId = String(
          body.productoId ?? body.ProductoId ?? body.producto_id ?? '',
        ).trim();
        if (!productoId || !/^\d+$/.test(productoId)) {
          throw new BadRequestException('El producto es obligatorio.');
        }

        const cantidad = Number(body.cantidad ?? body.Cantidad ?? 0);
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
          throw new BadRequestException('La cantidad debe ser un entero positivo.');
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

        const precioUnitario = Number(body.precioUnitario ?? producto.PrecioConIVA ?? producto.PrecioNormal) || 0;
        const subtotalItem = Math.round(precioUnitario * cantidad);
        totalVenta = subtotalItem;

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

        itemsCalculados.push({
          productoId: String(producto.Id),
          productoNombre: producto.Nombre,
          cantidad,
          precioUnitario,
          subtotal: subtotalItem,
          stockRestante: balance.Stock,
          movimientoId: String(movimiento.Id),
        });
      }

      const numeroTicket = `VP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Registrar también en la tabla compras para que figure en el Historial de Ventas
      const compra = await queryRunner.manager.save(
        queryRunner.manager.create(Compra, {
          Numero: numeroTicket,
          UsuarioId: responsableId,
          ClienteNombre: clienteNombre.slice(0, 150),
          ClienteCorreo: clienteCorreo.slice(0, 150),
          Fecha: fecha,
          Subtotal: totalVenta.toFixed(2),
          Impuestos: '0.00',
          Total: totalVenta.toFixed(2),
          MetodoPago: metodoPago.slice(0, 50),
          Estado: 'Enviado',
          FacturaId: null,
        }),
      );

      await queryRunner.manager.save(
        itemsCalculados.map((item) =>
          queryRunner.manager.create(CompraItem, {
            CompraId: compra.Id,
            ProductoId: item.productoId,
            Nombre: item.productoNombre,
            Cantidad: item.cantidad,
            PrecioUnitario: item.precioUnitario.toFixed(2),
            Subtotal: item.subtotal.toFixed(2),
          }),
        ),
      );

      await queryRunner.commitTransaction();

      let correoEnviado = false;

      // Envío de correo opcional si el cliente así lo quiere
      if (enviarCorreo && clienteCorreo && clienteCorreo.includes('@')) {
        try {
          correoEnviado = await this.emailService.enviarComprobanteVentaFisica(
            clienteCorreo,
            {
              numero: numeroTicket,
              puntoVenta: ubicacion.Nombre,
              vendedor: responsableNombre || 'Vendedor Café UNA',
              clienteNombre,
              metodoPago,
              fecha: fecha.toISOString(),
              items: itemsCalculados.map((i) => ({
                nombre: i.productoNombre,
                cantidad: i.cantidad,
                precioUnitario: i.precioUnitario,
                subtotal: i.subtotal,
              })),
              total: totalVenta,
              notas,
            },
          );
        } catch {
          correoEnviado = false;
        }
      }

      const primerItem = itemsCalculados[0];

      return {
        id: primerItem.movimientoId || `VP-${Date.now()}`,
        numero: numeroTicket,
        productoId: primerItem.productoId,
        productoNombre: primerItem.productoNombre,
        ubicacionId: ubicacion.Id,
        ubicacionCodigo: ubicacion.Codigo,
        ubicacionNombre: ubicacion.Nombre,
        cantidad: itemsCalculados.reduce((acc, i) => acc + i.cantidad, 0),
        fecha: fecha.toISOString(),
        notas,
        stockRestante: primerItem.stockRestante,
        responsableId,
        responsableNombre,
        clienteNombre,
        clienteCorreo,
        metodoPago,
        total: totalVenta,
        items: itemsCalculados,
        correoEnviado,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async enviarComprobante(
    body: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const destinatario = String(
      body.destinatario ?? body.correo ?? body.clienteCorreo ?? '',
    ).trim();
    if (!destinatario || !destinatario.includes('@')) {
      throw new BadRequestException('El correo del cliente es inválido.');
    }

    const itemsRaw = Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : [];
    if (itemsRaw.length === 0) {
      throw new BadRequestException('Debe incluir al menos un producto en el comprobante.');
    }

    const items = itemsRaw.map((item) => ({
      nombre: String(item.nombre ?? item.productoNombre ?? 'Producto Café UNA'),
      cantidad: Math.max(1, Number(item.cantidad) || 1),
      precioUnitario: Number(item.precioUnitario) || 0,
      subtotal: Number(item.subtotal) || 0,
    }));

    const total = Number(body.total) || items.reduce((acc, i) => acc + i.subtotal, 0);

    const ok = await this.emailService.enviarComprobanteVentaFisica(
      destinatario,
      {
        numero: String(body.numero || `VP-${Date.now().toString().slice(-6)}`),
        puntoVenta: String(body.puntoVenta || body.ubicacionNombre || 'Punto Presencial'),
        vendedor: String(body.vendedor || body.responsableNombre || 'Vendedor Café UNA'),
        clienteNombre: String(body.clienteNombre || ''),
        metodoPago: String(body.metodoPago || 'Efectivo'),
        fecha: String(body.fecha || new Date().toISOString()),
        items,
        total,
        notas: String(body.notas || ''),
      },
    );

    if (!ok) {
      return {
        success: false,
        message: 'No se pudo enviar el correo. Verifique la configuración SMTP del sistema.',
      };
    }

    return {
      success: true,
      message: `Comprobante enviado exitosamente a ${destinatario}.`,
    };
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
