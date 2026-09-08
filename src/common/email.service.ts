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

  constructor(private readonly config: ConfigService) {}

  async enviarCodigoRegistro(
    destinatario: string,
    nombre: string,
    codigo: string,
  ): Promise<boolean> {
    return this.enviar(
      destinatario,
      'Código de verificación - Café UNA',
      await this.buildCodeEmail(
        nombre,
        'Verifica tu cuenta',
        'Usá este código para completar tu registro en Café UNA:',
        codigo,
        'El código vence en 30 minutos. Si no creaste esta cuenta, ignorá este correo.',
      ),
    );
  }

  async enviarCodigoRecuperacion(
    destinatario: string,
    nombre: string,
    codigo: string,
  ): Promise<boolean> {
    return this.enviar(
      destinatario,
      'Código de recuperación de contraseña - Café UNA',
      await this.buildCodeEmail(
        nombre,
        'Recuperación de contraseña',
        'Usá este código para restablecer tu contraseña:',
        codigo,
        'El código vence en 30 minutos. Si no solicitaste este cambio, ignorá este correo.',
      ),
    );
  }

  async enviarCodigoCambioCorreo(
    destinatario: string,
    nombre: string,
    codigo: string,
  ): Promise<boolean> {
    return this.enviar(
      destinatario,
      'Verifica tu nuevo correo - Café UNA',
      await this.buildCodeEmail(
        nombre,
        'Cambio de correo',
        'Usá este código para confirmar tu nuevo correo en Café UNA:',
        codigo,
        'El código vence en 30 minutos. Si no solicitaste este cambio, ignorá este correo.',
      ),
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

  private async enviar(
    destinatario: string,
    subject: string,
    htmlBody: string,
  ): Promise<boolean> {
    const host = this.config.get<string>('SMTP_HOST');
    const fromEmail = this.config.get<string>('SMTP_FROM');
    if (!host || !fromEmail) {
      this.logger.warn(`SMTP no configurado. No se envió correo a ${destinatario}.`);
      return false;
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const fromName = this.config.get<string>('SMTP_FROM_NAME') ?? 'Café UNA';

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user ? { user, pass } : undefined,
      });

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: destinatario,
        subject,
        html: htmlBody,
      });

      this.logger.log(`Correo enviado correctamente a ${destinatario}.`);
      return true;
    } catch (error) {
      this.logger.error(`No se pudo enviar correo a ${destinatario}.`, error);
      return false;
    }
  }

  private async buildCodeEmail(
    nombre: string,
    titulo: string,
    mensaje: string,
    codigo: string,
    nota: string,
  ): Promise<string> {
    const saludo = nombre?.trim()
      ? `Hola, ${this.escapeHtml(nombre)}`
      : 'Hola';
    const template = await fs.readFile(this.templatePath, 'utf8');

    return template
      .replaceAll('{{saludo}}', saludo)
      .replaceAll('{{titulo}}', this.escapeHtml(titulo))
      .replaceAll('{{mensaje}}', this.escapeHtml(mensaje))
      .replaceAll('{{codigo}}', this.escapeHtml(codigo))
      .replaceAll('{{nota}}', this.escapeHtml(nota));
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

  async enviarAlertaStockBajo(
    destinatario: string,
    datos: {
      nombreAdmin: string;
      nombreProducto: string;
      stockActual: number;
      stockMinimo: number;
      productoId: string;
      ubicacionNombre: string;
    },
  ): Promise<boolean> {
    const html = `<div style="font-family: sans-serif; padding: 20px;">
      <h2>Alerta de Stock Bajo</h2>
      <p>Hola, ${this.escapeHtml(datos.nombreAdmin)}</p>
      <p>El producto <strong>${this.escapeHtml(datos.nombreProducto)}</strong> en <strong>${this.escapeHtml(datos.ubicacionNombre)}</strong> tiene stock bajo.</p>
      <p>Stock actual: <strong>${datos.stockActual}</strong> (mínimo: ${datos.stockMinimo})</p>
    </div>`;
    return this.enviar(destinatario, `Alerta de Stock Bajo - ${datos.nombreProducto}`, html);
  }

  async enviarComprobanteVentaFisica(
    destinatario: string,
    datos: {
      numero: string;
      puntoVenta: string;
      vendedor: string;
      clienteNombre?: string;
      metodoPago: string;
      fecha: string;
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
    const filas = (datos.items || [])
      .map(
        (i) =>
          `<tr><td>${this.escapeHtml(i.nombre)}</td><td>${i.cantidad}</td><td>₡${i.precioUnitario}</td><td>₡${i.subtotal}</td></tr>`,
      )
      .join('');
    const html = `<div style="font-family: sans-serif; padding: 20px;">
      <h2>Comprobante de Venta - Café UNA</h2>
      <p>Ticket: <strong>${this.escapeHtml(datos.numero)}</strong></p>
      <p>Punto de Venta: ${this.escapeHtml(datos.puntoVenta)}</p>
      <table border="1" cellpadding="5" style="border-collapse: collapse;">
        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio U.</th><th>Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <h3>Total: ₡${datos.total}</h3>
    </div>`;
    return this.enviar(destinatario, `Comprobante de Venta #${datos.numero}`, html);
  }

  async enviarConfirmacionVisitaGrupal(
    destinatario: string,
    datos: {
      nombreEncargado: string;
      fechaVisita: string;
      cantidad: number;
    },
  ): Promise<boolean> {
    const html = `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h2 style="color: #286f54; margin-top: 0;">Solicitud de Visita Grupal Recibida</h2>
      <p>Hola, <strong>${this.escapeHtml(datos.nombreEncargado)}</strong>:</p>
      <p>Su solicitud para una visita grupal de <strong>${datos.cantidad} personas</strong> el día <strong>${this.escapeHtml(datos.fechaVisita)}</strong> ha sido recibida correctamente en <strong>Café UNA</strong>.</p>
      <p style="background: #f0fdf4; padding: 12px; border-radius: 8px; border-left: 4px solid #286f54; color: #166534;">
        Su registro se encuentra actualmente en <strong>Estado Pendiente</strong>. El equipo coordinador evaluará la disponibilidad de la finca experimental y se comunicará con usted.
      </p>
      <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">Este es un mensaje automático de Café UNA - Universidad Nacional.</p>
    </div>`;
    return this.enviar(destinatario, 'Solicitud de Visita Grupal recibida - Café UNA', html);
  }

  async enviarActualizacionEstadoVisitaGrupal(
    destinatario: string,
    datos: {
      nombreEncargado: string;
      fechaVisita: string;
      estado: string;
      fechaActualizacion: string;
      motivoRechazo?: string | null;
    },
  ): Promise<boolean> {
    const estadoNorm = (datos.estado || '').trim().toLowerCase();
    const esRechazada = estadoNorm === 'rechazada' || estadoNorm === 'rechazado';
    const esAprobada = estadoNorm === 'aprobada' || estadoNorm === 'aprobado';

    const bloqueMotivo = esRechazada && datos.motivoRechazo?.trim()
      ? `<div style="margin: 16px 0; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #dc2626; color: #991b1b;">
          <strong>Motivo u observaciones:</strong><br>${this.escapeHtml(datos.motivoRechazo.trim())}
        </div>`
      : '';

    const bloqueAprobada = esAprobada
      ? `<div style="margin: 16px 0; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #286f54; color: #166534;">
          <strong>¡Visita aprobada!</strong><br>Por favor recuerde presentarse 10 minutos antes de la hora acordada.
        </div>`
      : '';

    const html = `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h2 style="color: #286f54; margin-top: 0;">Actualización de Solicitud de Visita Grupal</h2>
      <p>Hola, <strong>${this.escapeHtml(datos.nombreEncargado)}</strong>:</p>
      <p>Le informamos que su solicitud para la visita grupal programada para el <strong>${this.escapeHtml(datos.fechaVisita)}</strong> ha cambiado al estado: <strong style="text-transform: uppercase;">${this.escapeHtml(datos.estado)}</strong>.</p>
      ${bloqueAprobada}
      ${bloqueMotivo}
      <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">Fecha de actualización: ${this.escapeHtml(datos.fechaActualizacion)}<br>Café UNA - Universidad Nacional</p>
    </div>`;
    return this.enviar(destinatario, `Actualización de Visita Grupal (${datos.estado}) - Café UNA`, html);
  }
}


