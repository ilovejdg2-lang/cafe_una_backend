import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EmailService } from '../common/email.service';
import { AsignacionesPuntoVentaService } from './asignaciones-punto-venta.service';
import { Compra } from '../entities/compra.entity';
import { CompraItem } from '../entities/compra-item.entity';
import { Factura } from '../entities/factura.entity';
import { FacturaItem } from '../entities/factura-item.entity';
import { Pago } from '../entities/pago.entity';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Usuario } from '../entities/usuario.entity';
import { calcularStockDisponible } from '../common/inventario-stock.util';
import { BODEGA_CENTRAL } from './inventario.service';
import {
  insertarMovimientoInventario,
  TIPO_MOVIMIENTO,
} from '../common/movimiento-inventario.util';

const TIPO_VENTA_PRESENCIAL = TIPO_MOVIMIENTO.VENTA_PRESENCIAL;
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
  compraId?: number;
  facturaId?: string;
  pagoId?: number;
  correoEnviado?: boolean;
  correoMensaje?: string;
};

function leerPrecio(valor: unknown): number | null {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return null;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/** El cobro sale del catálogo. Un precio enviado distinto se rechaza. */
export function resolverPrecioCatalogo(
  producto: { Nombre?: string; PrecioConIVA?: unknown; PrecioNormal?: unknown },
  precioEnviado: unknown,
): number {
  const catalogo = leerPrecio(producto.PrecioConIVA) ?? leerPrecio(producto.PrecioNormal);
  if (catalogo == null || catalogo < 0) {
    throw new BadRequestException(
      `El producto ${producto.Nombre || ''} no tiene un precio de catálogo válido.`.trim(),
    );
  }
  if (
    precioEnviado !== undefined &&
    precioEnviado !== null &&
    String(precioEnviado).trim() !== ''
  ) {
    const enviado = Number(precioEnviado);
    if (!Number.isFinite(enviado) || Math.abs(enviado - catalogo) > 0.009) {
      throw new BadRequestException(
        `El precio de "${producto.Nombre}" no coincide con el catálogo.`,
      );
    }
  }
  return catalogo;
}

@Injectable()
export class VentasPresencialesService {
  private readonly logger = new Logger(VentasPresencialesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly asignaciones: AsignacionesPuntoVentaService,
  ) {}

  async listarPuntosPermitidos(actor: { userId?: number | null; roles?: string[] }) {
    return this.asignaciones.listarPuntosOperables({
      userId: actor?.userId ?? 0,
      roles: actor?.roles ?? [],
    });
  }

  async registrar(
    body: Record<string, unknown>,
    responsableId: number | null,
    roles: string[] = [],
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
      await this.asignaciones.exigirVentaEnPunto(
        responsableId,
        roles,
        ubicacion,
        queryRunner.manager,
      );

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
          const fisico = Number(balance?.Stock ?? 0) || 0;
          const disponible = calcularStockDisponible(
            fisico,
            balance?.StockReservado ?? 0,
          );
          if (disponible < cant) {
            throw new BadRequestException(
              `Stock insuficiente para "${producto.Nombre}" en este punto. Disponible: ${disponible} unid.`,
            );
          }

          const precioUnitario = resolverPrecioCatalogo(
            producto,
            item.precioUnitario ?? item.PrecioUnitario,
          );

          if (!balance) {
            balance = queryRunner.manager.create(InventarioStockUbicacion, {
              ProductoId: String(producto.Id),
              UbicacionId: ubicacion.Id,
              Stock: fisico,
              StockReservado: 0,
            });
          }
          balance.Stock = fisico - cant;
          await queryRunner.manager.save(balance);

          const subtotalItem = Math.round(precioUnitario * cant);
          totalVenta += subtotalItem;

          const mov = await insertarMovimientoInventario(queryRunner.manager, {
            tipo: TIPO_VENTA_PRESENCIAL,
            productoId: String(producto.Id),
            cantidad: cant,
            responsableId,
            responsableNombre,
            notas,
            ubicacionId: ubicacion.Id,
            ubicacionOrigenId: ubicacion.Id,
            fecha,
          });

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
        const fisico = Number(balance?.Stock ?? 0) || 0;
        const disponible = calcularStockDisponible(
          fisico,
          balance?.StockReservado ?? 0,
        );
        if (disponible < cantidad) {
          throw new BadRequestException(
            `Stock disponible en este punto: ${disponible} unidades.`,
          );
        }

        const precioUnitario = resolverPrecioCatalogo(
          producto,
          body.precioUnitario ?? body.PrecioUnitario,
        );

        if (!balance) {
          balance = queryRunner.manager.create(InventarioStockUbicacion, {
            ProductoId: String(producto.Id),
            UbicacionId: ubicacion.Id,
            Stock: fisico,
            StockReservado: 0,
          });
        }
        balance.Stock = fisico - cantidad;
        await queryRunner.manager.save(balance);

        const subtotalItem = Math.round(precioUnitario * cantidad);
        totalVenta = subtotalItem;

        const movimiento = await insertarMovimientoInventario(queryRunner.manager, {
          tipo: TIPO_VENTA_PRESENCIAL,
          productoId: String(producto.Id),
          cantidad,
          responsableId,
          responsableNombre,
          notas,
          ubicacionId: ubicacion.Id,
          ubicacionOrigenId: ubicacion.Id,
          fecha,
        });

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
          UbicacionId: ubicacion.Id,
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

      const pago = await queryRunner.manager.save(
        queryRunner.manager.create(Pago, {
          CompraId: Number(compra.Id),
          Monto: totalVenta.toFixed(2),
          Metodo: (metodoPago || 'Efectivo').slice(0, 50),
          Estado: 'Pagado',
        }),
      );

      const facturaId = `FAC-${numeroTicket}`;
      const factura = await queryRunner.manager.save(
        queryRunner.manager.create(Factura, {
          Id: facturaId,
          CompraId: Number(compra.Id),
          UsuarioId: responsableId,
          NumeroConsecutivo: numeroTicket,
          Subtotal: totalVenta.toFixed(2),
          Impuestos: '0.00',
          Total: totalVenta.toFixed(2),
          Estado: 'Emitida',
          FechaEmision: fecha,
        }),
      );
      await queryRunner.manager.save(
        itemsCalculados.map((item) =>
          queryRunner.manager.create(FacturaItem, {
            FacturaId: factura.Id,
            ProductoId: item.productoId,
            Descripcion: String(item.productoNombre || 'Producto').slice(0, 250),
            Cantidad: item.cantidad,
            PrecioUnitario: item.precioUnitario.toFixed(2),
            Subtotal: item.subtotal.toFixed(2),
          }),
        ),
      );
      compra.FacturaId = factura.Id;
      await queryRunner.manager.save(compra);

      await queryRunner.commitTransaction();

      let correoEnviado = false;
      let correoMensaje = '';

      // El correo del comprobante basta para enviarlo. No depende de un check aparte.
      if (this.correoValido(clienteCorreo)) {
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
                nombre: String(i.productoNombre || 'Producto Café UNA'),
                cantidad: i.cantidad,
                precioUnitario: i.precioUnitario,
                subtotal: i.subtotal,
              })),
              total: totalVenta,
              notas,
            },
          );
          if (!correoEnviado) {
            correoMensaje =
              'No se pudo enviar el comprobante. Podés reintentarlo desde el resumen.';
          }
        } catch (error) {
          this.logger.error(
            `No se envió el comprobante ${numeroTicket} a ${clienteCorreo}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          correoEnviado = false;
          correoMensaje =
            'No se pudo enviar el comprobante. Podés reintentarlo desde el resumen.';
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
        compraId: Number(compra.Id) || undefined,
        facturaId: factura.Id,
        pagoId: Number(pago.Id) || undefined,
        responsableId,
        responsableNombre,
        clienteNombre,
        clienteCorreo,
        metodoPago,
        total: totalVenta,
        items: itemsCalculados,
        correoEnviado,
        correoMensaje,
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

  private correoValido(valor: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
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
