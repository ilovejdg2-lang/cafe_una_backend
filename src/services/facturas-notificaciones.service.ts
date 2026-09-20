import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EmailService } from '../common/email.service';
import { Compra } from '../entities/compra.entity';
import { Factura } from '../entities/factura.entity';

export type EstadoInfoVisual = {
  badgeColor: string;
  badgeBg: string;
  tituloEstado: string;
  mensajeEstado: string;
};

@Injectable()
export class FacturasNotificacionesService {
  private readonly logger = new Logger(FacturasNotificacionesService.name);
  private readonly facturaTemplatePath = path.join(
    process.cwd(),
    'Templates',
    'Email',
    'factura-compra.html',
  );
  private readonly actualizacionTemplatePath = path.join(
    process.cwd(),
    'Templates',
    'Email',
    'actualizacion-compra.html',
  );

  constructor(private readonly emailService: EmailService) {}

  /**
   * Envía correo con factura electrónica en PDF adjunta al cliente con reintentos.
   */
  async enviarFacturaPorCorreo(
    factura: Factura,
    pdfBuffer: Buffer,
    pdfFilename: string,
  ): Promise<boolean> {
    const correo = (factura.Compra?.ClienteCorreo || '').trim();
    if (!correo) {
      this.logger.warn(
        `Factura ${factura.NumeroConsecutivo || factura.Id}: no hay correo de cliente asociado.`,
      );
      return false;
    }

    const clienteNombre = factura.Compra?.ClienteNombre || 'Estimado(a) cliente';
    const numeroCompra = factura.Compra?.Numero || 'N/A';
    const numeroFactura = factura.NumeroConsecutivo || factura.Id;
    const metodoPago = factura.Compra?.MetodoPago || 'Comprobante';
    const fecha = factura.FechaEmision
      ? new Date(factura.FechaEmision).toLocaleDateString('es-CR')
      : new Date().toLocaleDateString('es-CR');

    const subtotalFmt = `₡ ${Number(factura.Subtotal || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
    const impuestosFmt = `₡ ${Number(factura.Impuestos || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
    const totalFmt = `₡ ${Number(factura.Total || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;

    const items = factura.Items || [];
    const tablaItemsHtml = items
      .map(
        (it) => `
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 10px;">${it.Descripcion || 'Producto'}</td>
          <td style="padding: 10px; text-align: center;">${it.Cantidad}</td>
          <td style="padding: 10px; text-align: right;">₡ ${Number(it.PrecioUnitario || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
          <td style="padding: 10px; text-align: right; font-weight: bold;">₡ ${Number(it.Subtotal || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
        </tr>`,
      )
      .join('');

    let template: string;
    try {
      template = await fs.readFile(this.facturaTemplatePath, 'utf8');
    } catch {
      template = `
        <h1>Factura de compra - Café UNA</h1>
        <p>Hola {{saludo}}, adjuntamos la factura {{numeroFactura}} correspondiente a tu orden {{numeroCompra}}.</p>
        <p>Total: {{total}}</p>
      `;
    }

    const html = template
      .replace(/\{\{saludo\}\}/g, `Hola, ${clienteNombre}`)
      .replace(/\{\{clienteNombre\}\}/g, clienteNombre)
      .replace(/\{\{numeroCompra\}\}/g, numeroCompra)
      .replace(/\{\{numeroFactura\}\}/g, numeroFactura)
      .replace(/\{\{fecha\}\}/g, fecha)
      .replace(/\{\{metodoPago\}\}/g, metodoPago)
      .replace(/\{\{tablaItems\}\}/g, tablaItemsHtml)
      .replace(/\{\{subtotal\}\}/g, subtotalFmt)
      .replace(/\{\{impuestos\}\}/g, impuestosFmt)
      .replace(/\{\{total\}\}/g, totalFmt);

    const attachments = [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ];

    const subject = `Factura de compra ${numeroFactura} - Café UNA`;

    return this.ejecutarConReintentos(
      () => this.emailService.enviar(correo, subject, html, undefined, attachments),
      `Envío de factura ${numeroFactura} a ${correo}`,
    );
  }

  /**
   * Envía correo informando cambio en el estado de una orden.
   */
  async enviarActualizacionEstadoCompra(
    compra: Compra,
    nuevoEstado: string,
    adjuntos?: Array<{ filename: string; content: Buffer; contentType: string }>,
  ): Promise<boolean> {
    const correo = (compra.ClienteCorreo || '').trim();
    if (!correo) {
      this.logger.warn(`Compra #${compra.Id}: sin correo de cliente asociado.`);
      return false;
    }

    const info = this.obtenerInfoVisualEstado(nuevoEstado);
    const clienteNombre = compra.ClienteNombre || 'Estimado(a) cliente';
    const totalFmt = `₡ ${Number(compra.Total || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
    const fechaActualizacion = new Date().toLocaleString('es-CR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    let template: string;
    try {
      template = await fs.readFile(this.actualizacionTemplatePath, 'utf8');
    } catch {
      template = `
        <h1>Actualización de compra</h1>
        <p>Hola {{saludo}}, tu orden {{numeroCompra}} ha pasado al estado: {{estado}}.</p>
        <p>{{mensajeEstado}}</p>
      `;
    }

    const html = template
      .replace(/\{\{saludo\}\}/g, `Hola, ${clienteNombre}`)
      .replace(/\{\{numeroCompra\}\}/g, compra.Numero)
      .replace(/\{\{estado\}\}/g, nuevoEstado)
      .replace(/\{\{badgeColor\}\}/g, info.badgeColor)
      .replace(/\{\{badgeBg\}\}/g, info.badgeBg)
      .replace(/\{\{tituloEstado\}\}/g, info.tituloEstado)
      .replace(/\{\{mensajeEstado\}\}/g, info.mensajeEstado)
      .replace(/\{\{fechaActualizacion\}\}/g, fechaActualizacion)
      .replace(/\{\{total\}\}/g, totalFmt);

    const subject = `Actualización de orden #${compra.Numero}: ${nuevoEstado} - Café UNA`;

    return this.ejecutarConReintentos(
      () => this.emailService.enviar(correo, subject, html, undefined, adjuntos),
      `Actualización de orden #${compra.Numero} (${nuevoEstado}) a ${correo}`,
    );
  }

  /**
   * Mapea el estado de una compra a información visual y explicativa para el cliente.
   */
  private obtenerInfoVisualEstado(estadoRaw: string): EstadoInfoVisual {
    const estado = (estadoRaw || '').trim().toLowerCase();

    switch (estado) {
      case 'aceptado':
      case 'aprobado':
      case 'pagado':
        return {
          badgeColor: '#059669',
          badgeBg: '#D1FAE5',
          tituloEstado: '¡Tu pago ha sido validado!',
          mensajeEstado:
            'Hemos comprobado tu pago exitosamente. Tu orden ha sido aceptada y nuestro equipo está preparando los productos. Se adjunta tu factura electrónica oficial de compra.',
        };
      case 'enviado':
        return {
          badgeColor: '#4F46E5',
          badgeBg: '#E0E7FF',
          tituloEstado: 'Tu pedido va en camino',
          mensajeEstado:
            'Tu compra ha sido despachada hacia la dirección coordinada. Pronto podrás disfrutar del auténtico Café UNA.',
        };
      case 'entregado':
        return {
          badgeColor: '#2563EB',
          badgeBg: '#DBEAFE',
          tituloEstado: 'Pedido entregado con éxito',
          mensajeEstado:
            'Tu pedido figura como entregado. Esperamos que disfrutes de nuestros cafés de especialidad. ¡Muchas gracias por tu apoyo!',
        };
      case 'rechazado':
      case 'cancelado':
        return {
          badgeColor: '#E11D48',
          badgeBg: '#FFE4E6',
          tituloEstado: 'Tu orden no pudo ser procesada',
          mensajeEstado:
            'Lamentablemente tu comprobante o datos de compra no pudieron ser verificados. Podés comunicarte con nosotros para solucionar el inconveniente o realizar un nuevo pedido.',
        };
      case 'pendiente':
      default:
        return {
          badgeColor: '#D97706',
          badgeBg: '#FEF3C7',
          tituloEstado: 'Orden recibida en revisión',
          mensajeEstado:
            'Hemos recibido los detalles de tu compra y tu comprobante. Nuestro personal revisará la transacción en breve.',
        };
    }
  }

  /**
   * Mecanismo de reintentos con backoff exponencial.
   */
  private async ejecutarConReintentos(
    operacion: () => Promise<boolean>,
    descripcion: string,
    maxReintentos = 3,
  ): Promise<boolean> {
    let intento = 0;
    let delayMs = 1000;

    while (intento < maxReintentos) {
      intento++;
      try {
        const ok = await operacion();
        if (ok) {
          return true;
        }
      } catch (err) {
        this.logger.warn(
          `Fallo en intento ${intento}/${maxReintentos} para "${descripcion}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }

      if (intento < maxReintentos) {
        await new Promise((res) => setTimeout(res, delayMs));
        delayMs *= 2;
      }
    }

    this.logger.error(
      `No se pudo completar "${descripcion}" tras ${maxReintentos} intentos.`,
    );
    return false;
  }
}
