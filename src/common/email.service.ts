import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as nodemailer from 'nodemailer';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly templatePath = path.join(
    process.cwd(),
    'Templates',
    'Email',
    'codigo-verificacion.html',
  );
  private readonly voluntariadoTemplatePath = path.join(
    process.cwd(),
    'Templates',
    'Email',
    'confirmacion-voluntariado.html',
  );
  private readonly actualizacionVoluntariadoTemplatePath = path.join(
    process.cwd(),
    'Templates',
    'Email',
    'actualizacion-voluntariado.html',
  );
  private readonly alertaStockTemplatePath = path.join(
    process.cwd(),
    'Templates',
    'Email',
    'alerta-stock.html',
  );

  constructor(private readonly config: ConfigService) {}

  async enviarCodigoRegistro(
    destinatario: string,
    nombre: string,
    codigo: string,
  ): Promise<boolean> {
    const contenido = await this.buildCodeEmail(
      nombre,
      'Verifica tu cuenta',
      'Usá este código para completar tu registro en Café UNA:',
      codigo,
      'El código vence en 30 minutos. Si no creaste esta cuenta, ignorá este correo.',
    );
    return this.enviar(
      destinatario,
      'Código de verificación - Café UNA',
      contenido.html,
      contenido.text,
    );
  }

  async enviarCodigoRecuperacion(
    destinatario: string,
    nombre: string,
    codigo: string,
  ): Promise<boolean> {
    const contenido = await this.buildCodeEmail(
      nombre,
      'Recuperación de contraseña',
      'Usá este código para restablecer tu contraseña:',
      codigo,
      'El código vence en 30 minutos. Si no solicitaste este cambio, ignorá este correo.',
    );
    return this.enviar(
      destinatario,
      'Código de recuperación de contraseña - Café UNA',
      contenido.html,
      contenido.text,
    );
  }

  async enviarCodigoCambioCorreo(
    destinatario: string,
    nombre: string,
    codigo: string,
  ): Promise<boolean> {
    const contenido = await this.buildCodeEmail(
      nombre,
      'Cambio de correo',
      'Usá este código para confirmar tu nuevo correo en Café UNA:',
      codigo,
      'El código vence en 30 minutos. Si no solicitaste este cambio, ignorá este correo.',
    );
    return this.enviar(
      destinatario,
      'Verifica tu nuevo correo - Café UNA',
      contenido.html,
      contenido.text,
    );
  }

  async enviarConfirmacionVoluntariado(
    destinatario: string,
    nombre: string,
  ): Promise<boolean> {
    return this.enviar(
      destinatario,
      'Solicitud de voluntariado recibida - Café UNA',
      await this.buildVoluntariadoEmail(nombre),
    );
  }

  async enviarActualizacionEstadoVoluntariado(
    destinatario: string,
    datos: {
      nombre: string;
      tipoVoluntariado: string;
      periodo: string;
      estado: string;
      fechaActualizacion: string;
      motivoRechazo?: string | null;
    },
  ): Promise<boolean> {
    return this.enviar(
      destinatario,
      'Actualización de su solicitud de voluntariado - Café UNA',
      await this.buildActualizacionVoluntariadoEmail(datos),
    );
  }

  async enviarAlertaStockBajo(
    destinatario: string,
    datos: {
      nombreAdmin: string;
      nombreProducto: string;
      stockActual: number;
      stockMinimo: number;
      productoId: string;
      ubicacionNombre?: string;
    },
  ): Promise<boolean> {
    const agotado = datos.stockActual <= 0;
    const titulo = agotado ? 'Producto agotado' : 'Stock bajo';
    const lugar = datos.ubicacionNombre?.trim()
      ? ` en ${datos.ubicacionNombre.trim()}`
      : '';
    const mensaje = agotado
      ? `Un producto del inventario de Café UNA se quedó sin unidades disponibles${lugar}.`
      : `Un producto del inventario de Café UNA bajó al stock mínimo o por debajo${lugar}.`;
    const nota = `Revisá el panel de inventario (producto #${datos.productoId}) para reponer o transferir stock. Este es un aviso automático para SuperAdmin.`;

    return this.enviar(
      destinatario,
      `${titulo}: ${datos.nombreProducto} - Café UNA`,
      await this.buildAlertaStockEmail({
        nombreAdmin: datos.nombreAdmin,
        titulo,
        mensaje,
        nombreProducto: datos.nombreProducto,
        stockActual: String(datos.stockActual),
        stockMinimo: String(datos.stockMinimo),
        nota,
      }),
    );
  }

  async enviarComprobanteVentaFisica(
    destinatario: string,
    datos: {
      numero?: string;
      puntoVenta: string;
      vendedor: string;
      clienteNombre?: string;
      metodoPago: string;
      fecha?: string;
      items: Array<{
        nombre: string;
        cantidad: number;
        precioUnitario: number;
        subtotal: number;
      }>;
      total: number;
      notas?: string;
    },
  ): Promise<boolean> {
    const htmlBody = this.buildComprobanteVentaHtml(datos);
    return this.enviar(
      destinatario,
      `Comprobante de compra - Café UNA (${datos.numero || 'Venta Física'})`,
      htmlBody,
    );
  }

  private buildComprobanteVentaHtml(datos: {
    numero?: string;
    puntoVenta: string;
    vendedor: string;
    clienteNombre?: string;
    metodoPago: string;
    fecha?: string;
    items: Array<{
      nombre: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }>;
    total: number;
    notas?: string;
  }): string {
    const fmt = (num: number) =>
      `₡${Math.round(Number(num) || 0).toLocaleString('es-CR')}`;

    const fechaFormateada = datos.fecha
      ? new Date(datos.fecha).toLocaleString('es-CR', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : new Date().toLocaleString('es-CR', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

    const subtotalSinIva = Math.round(datos.total / 1.13);
    const ivaMonto = Math.round(datos.total - subtotalSinIva);

    const itemsRows = (datos.items || [])
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 14px 10px; font-size: 14px; color: #0f172a; font-weight: 600; vertical-align: middle;">
            ${this.escapeHtml(item.nombre)}
          </td>
          <td style="padding: 14px 8px; font-size: 13px; color: #475569; text-align: center; vertical-align: middle; font-weight: 500;">
            <span style="display: inline-block; background-color: #f1f5f9; border-radius: 6px; padding: 2px 8px; font-weight: 600;">${item.cantidad}</span>
          </td>
          <td style="padding: 14px 10px; font-size: 13px; color: #64748b; text-align: right; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${fmt(item.precioUnitario)}
          </td>
          <td style="padding: 14px 10px; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${fmt(item.subtotal)}
          </td>
        </tr>`,
      )
      .join('');

    const numeroComprobante = this.escapeHtml(datos.numero || 'VP-' + Date.now());

    return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>Comprobante de Venta - Café UNA</title>
  <style>
    body, table, td, p, h1, h2, span, a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    img { border: 0; outline: none; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .email-card { width: 100% !important; border-radius: 0 !important; }
      .email-pad { padding: 20px 16px !important; }
      .meta-col { display: block !important; width: 100% !important; margin-bottom: 8px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f8" style="background-color: #f4f5f8; width: 100%;">
    <tr>
      <td align="center" style="padding: 32px 12px 40px;">
        <!-- Contenedor Principal / Tarjeta de Factura -->
        <table role="presentation" class="email-card" width="580" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width: 100%; max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
          
          <!-- Logo Oficial Café UNA -->
          <tr>
            <td align="center" bgcolor="#ffffff" style="padding: 28px 24px 18px; background-color: #ffffff;">
              <img src="https://i.ibb.co/gbQgcRq3/Captura-de-pantalla-2026-06-15-011218.webp" alt="Café UNA" width="190" style="display: block; width: 190px; max-width: 190px; height: auto; margin: 0 auto;" />
            </td>
          </tr>

          <!-- Barra de Acento Rojo Institucional Café UNA -->
          <tr>
            <td bgcolor="#C41E3A" style="background-color: #C41E3A; height: 4px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Cuadro de Datos de la Factura -->
          <tr>
            <td class="email-pad" style="padding: 24px 32px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px 20px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #57534e; width: 45%;" valign="top">
                    <strong style="color: #1c1917;">Comprobante:</strong>
                  </td>
                  <td style="padding: 6px 0; font-size: 13px; color: #1c1917; text-align: right; font-family: Consolas, monospace; font-weight: 700;" valign="top">
                    ${numeroComprobante}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #57534e;" valign="top">
                    <strong style="color: #1c1917;">Fecha y hora:</strong>
                  </td>
                  <td style="padding: 6px 0; font-size: 13px; color: #1c1917; text-align: right; font-weight: 500;" valign="top">
                    ${fechaFormateada}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-size: 13px; color: #57534e;" valign="top">
                    <strong style="color: #1c1917;">Punto de venta:</strong>
                  </td>
                  <td style="padding: 5px 0; font-size: 13px; color: #1c1917; text-align: right; font-weight: 600;" valign="top">
                    ${this.escapeHtml(datos.puntoVenta || 'Punto Presencial')}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-size: 13px; color: #57534e;" valign="top">
                    <strong style="color: #1c1917;">Atendido por:</strong>
                  </td>
                  <td style="padding: 5px 0; font-size: 13px; color: #1c1917; text-align: right;" valign="top">
                    ${this.escapeHtml(datos.vendedor || 'Personal Café UNA')}
                  </td>
                </tr>
                ${
                  datos.clienteNombre
                    ? `<tr>
                        <td style="padding: 5px 0; font-size: 13px; color: #57534e;" valign="top">
                          <strong style="color: #1c1917;">Cliente:</strong>
                        </td>
                        <td style="padding: 5px 0; font-size: 13px; color: #1c1917; text-align: right; font-weight: 500;" valign="top">
                          ${this.escapeHtml(datos.clienteNombre)}
                        </td>
                      </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 5px 0; font-size: 13px; color: #57534e;" valign="top">
                    <strong style="color: #1c1917;">Método de pago:</strong>
                  </td>
                  <td style="padding: 5px 0; font-size: 13px; color: #1c1917; text-align: right; font-weight: 600;" valign="top">
                    ${this.escapeHtml(datos.metodoPago || 'Efectivo')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabla de Productos Desglosada -->
          <tr>
            <td class="email-pad" style="padding: 12px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%;">
                <thead>
                  <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 10px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; text-align: left;">Producto</th>
                    <th style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; text-align: center;">Cant.</th>
                    <th style="padding: 10px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; text-align: right;">Unitario</th>
                    <th style="padding: 10px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>

              <!-- Desglose de Totales -->
              <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding: 4px 10px; font-size: 13px; color: #64748b; text-align: right;">Subtotal (sin IVA):</td>
                    <td style="padding: 4px 10px; font-size: 13px; color: #334155; text-align: right; width: 110px; font-weight: 500;">${fmt(subtotalSinIva)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 10px; font-size: 13px; color: #64748b; text-align: right;">IVA (13% incluido):</td>
                    <td style="padding: 4px 10px; font-size: 13px; color: #334155; text-align: right; width: 110px; font-weight: 500;">${fmt(ivaMonto)}</td>
                  </tr>
                </table>
              </div>

              <!-- Bloque Prominente del Total Pagado -->
              <div style="margin-top: 16px; background-color: #0f172a; border-radius: 12px; padding: 18px 20px; color: #ffffff;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="color: #e2e8f0;">
                      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; opacity: 0.8; display: block;">Total Cancelado</span>
                      <span style="font-size: 13px; color: #94a3b8; margin-top: 2px; display: block;">Moneda de curso legal (CRC)</span>
                    </td>
                    <td valign="middle" align="right" style="text-align: right;">
                      <span style="font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        ${fmt(datos.total)}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              ${
                datos.notas?.trim()
                  ? `<div style="margin-top: 16px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #92400e;">
                      <strong style="color: #78350f;">Notas de la venta:</strong> ${this.escapeHtml(datos.notas.trim())}
                    </div>`
                  : ''
              }
            </td>
          </tr>

          <!-- Divisor Sutil -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="border-top: 1px dashed #cbd5e1; height: 1px; line-height: 1px;">&nbsp;</div>
            </td>
          </tr>

          <!-- Pie de Página Institucional -->
          <tr>
            <td class="email-pad" align="center" style="padding: 24px 32px 30px; text-align: center; background-color: #ffffff;">
              <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #C41E3A; letter-spacing: 1.2px; text-transform: uppercase;">
                Café UNA
              </p>
              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #334155;">
                Universidad Nacional de Costa Rica
              </p>
              <p style="margin: 0 0 14px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                Campus Omar Dengo, Heredia · Fomentando la cultura y excelencia del café costarricense
              </p>
              <p style="margin: 0; font-size: 10px; color: #cbd5e1; font-family: Consolas, monospace; letter-spacing: 2px;">
                |||| | |||| ||| || |||||| | ||||| ||| |||
              </p>
              <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;">
                Documento de compra emitido electrónicamente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private async enviar(
    destinatario: string,
    subject: string,
    htmlBody: string,
    textBody?: string,
  ): Promise<boolean> {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const fromEmail =
      this.config.get<string>('SMTP_FROM')?.trim() || user;
    if (!host || !fromEmail) {
      this.logger.warn(`SMTP no configurado. No se envió correo a ${destinatario}.`);
      return false;
    }

    const port = Number(this.config.get<string>('SMTP_PORT')?.trim() || 587);
    const pass = (this.config.get<string>('SMTP_PASS') ?? '').replace(/\s+/g, '');
    const fromName = this.config.get<string>('SMTP_FROM_NAME')?.trim() || 'Café UNA';

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: user ? { user, pass } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
        tls: {
          minVersion: 'TLSv1.2',
          servername: host,
        },
      });

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: destinatario.trim(),
        subject,
        html: htmlBody,
        text: textBody || undefined,
      });

      this.logger.log(`Correo enviado correctamente a ${destinatario}.`);
      return true;
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo enviar correo a ${destinatario}: ${detalle}`);
      return false;
    }
  }

  private async buildCodeEmail(
    nombre: string,
    titulo: string,
    mensaje: string,
    codigo: string,
    nota: string,
  ): Promise<{ html: string; text: string }> {
    const nombreLimpio = nombre?.trim() || '';
    const saludo = nombreLimpio ? `Hola, ${nombreLimpio}` : 'Hola';
    const text = [
      saludo,
      '',
      titulo,
      '',
      mensaje,
      '',
      `Tu código: ${codigo}`,
      '',
      nota,
      '',
      'Café UNA — Universidad Nacional, Costa Rica',
    ].join('\n');

    try {
      const template = await fs.readFile(this.templatePath, 'utf8');
      const html = template
        .replaceAll('{{saludo}}', this.escapeHtml(saludo))
        .replaceAll('{{titulo}}', this.escapeHtml(titulo))
        .replaceAll('{{mensaje}}', this.escapeHtml(mensaje))
        .replaceAll('{{codigo}}', this.escapeHtml(codigo))
        .replaceAll('{{nota}}', this.escapeHtml(nota));
      return { html, text };
    } catch (error) {
      this.logger.warn(
        `No se leyó la plantilla de código. Se usa el correo sencillo. ${
          error instanceof Error ? error.message : ''
        }`,
      );
      return {
        html: `<p>${this.escapeHtml(saludo)}</p><h1>${this.escapeHtml(titulo)}</h1><p>${this.escapeHtml(mensaje)}</p><p><strong>${this.escapeHtml(codigo)}</strong></p><p>${this.escapeHtml(nota)}</p>`,
        text,
      };
    }
  }

  private async buildAlertaStockEmail(datos: {
    nombreAdmin: string;
    titulo: string;
    mensaje: string;
    nombreProducto: string;
    stockActual: string;
    stockMinimo: string;
    nota: string;
  }): Promise<string> {
    const saludo = datos.nombreAdmin?.trim()
      ? `Hola, ${this.escapeHtml(datos.nombreAdmin)}`
      : 'Hola';
    const template = await fs.readFile(this.alertaStockTemplatePath, 'utf8');

    return template
      .replaceAll('{{saludo}}', saludo)
      .replaceAll('{{titulo}}', this.escapeHtml(datos.titulo))
      .replaceAll('{{mensaje}}', this.escapeHtml(datos.mensaje))
      .replaceAll('{{nombreProducto}}', this.escapeHtml(datos.nombreProducto))
      .replaceAll('{{stockActual}}', this.escapeHtml(datos.stockActual))
      .replaceAll('{{stockMinimo}}', this.escapeHtml(datos.stockMinimo))
      .replaceAll('{{nota}}', this.escapeHtml(datos.nota));
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private async buildVoluntariadoEmail(nombre: string): Promise<string> {
    const saludo = nombre?.trim()
      ? `Hola, ${this.escapeHtml(nombre)}`
      : 'Hola';

    try {
      const template = await fs.readFile(this.voluntariadoTemplatePath, 'utf8');
      return template.replaceAll('{{saludo}}', saludo);
    } catch {
      // Fallback inline template if file doesn't exist
      return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
    <h2 style="color: #286f54; margin: 0 0 16px; font-size: 22px;">${saludo}</h2>
    <p style="color: #374151; line-height: 1.7; margin: 0 0 16px;">
      Su solicitud de voluntariado fue <strong>recibida correctamente</strong> y está siendo revisada por el equipo de Café UNA.
    </p>
    <p style="color: #374151; line-height: 1.7; margin: 0 0 16px;">
      Recibirá información sobre el resultado de su solicitud en su correo electrónico.
    </p>
    <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      Este es un correo automático de Café UNA. No es necesario responderlo.
    </p>
  </div>
</body>
</html>`;
    }
  }

  private async buildActualizacionVoluntariadoEmail(datos: {
    nombre: string;
    tipoVoluntariado: string;
    periodo: string;
    estado: string;
    fechaActualizacion: string;
    motivoRechazo?: string | null;
  }): Promise<string> {
    const saludo = datos.nombre?.trim()
      ? `Hola, ${this.escapeHtml(datos.nombre)}`
      : 'Hola';
    const estadoNormalizado = datos.estado.trim().toLowerCase();
    const motivo = datos.motivoRechazo?.trim();

    const bloqueMotivoRechazo =
      estadoNormalizado === 'rechazado' && motivo
        ? `<div style="margin: 16px 0; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 3px solid #dc2626;">
            <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.6;">
              <strong>Motivo del rechazo:</strong><br>${this.escapeHtml(motivo)}
            </p>
          </div>`
        : '';

    const bloqueInstruccionesAprobacion =
      estadoNormalizado === 'aprobado'
        ? `<div style="margin: 16px 0; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 3px solid #286f54;">
            <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
              <strong>Próximos pasos</strong><br>
              Su solicitud fue aprobada. Por favor comuníquese con el equipo de Café UNA para coordinar los detalles de inicio de su voluntariado.
            </p>
          </div>`
        : '';

    try {
      const template = await fs.readFile(
        this.actualizacionVoluntariadoTemplatePath,
        'utf8',
      );
      return template
        .replaceAll('{{saludo}}', saludo)
        .replaceAll(
          '{{tipoVoluntariado}}',
          this.escapeHtml(datos.tipoVoluntariado || 'No indicado'),
        )
        .replaceAll(
          '{{periodo}}',
          this.escapeHtml(datos.periodo || 'No indicado'),
        )
        .replaceAll('{{estado}}', this.escapeHtml(datos.estado))
        .replaceAll(
          '{{fechaActualizacion}}',
          this.escapeHtml(datos.fechaActualizacion),
        )
        .replaceAll('{{bloqueMotivoRechazo}}', bloqueMotivoRechazo)
        .replaceAll(
          '{{bloqueInstruccionesAprobacion}}',
          bloqueInstruccionesAprobacion,
        );
    } catch {
      return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px;">
    <h2 style="color: #286f54;">${saludo}</h2>
    <p style="color: #374151; line-height: 1.7;">Su solicitud de voluntariado ha sido actualizada.</p>
    <p style="color: #374151; line-height: 1.7;"><strong>Tipo:</strong> ${this.escapeHtml(datos.tipoVoluntariado || 'No indicado')}</p>
    <p style="color: #374151; line-height: 1.7;"><strong>Período:</strong> ${this.escapeHtml(datos.periodo || 'No indicado')}</p>
    <p style="color: #374151; line-height: 1.7;"><strong>Estado:</strong> ${this.escapeHtml(datos.estado)}</p>
    <p style="color: #374151; line-height: 1.7;"><strong>Fecha:</strong> ${this.escapeHtml(datos.fechaActualizacion)}</p>
    ${bloqueMotivoRechazo}
    ${bloqueInstruccionesAprobacion}
  </div>
</body>
</html>`;
    }
  }
}
