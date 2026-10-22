import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { resolverSedeFinca, type SedeFinca } from './sede-finca';
import {
  CODIGO_DIGITOS,
  TOKEN_LIFETIME_MINUTES,
} from './verificacion-correo.util';

export const LOGO_PLACEHOLDER = '{{logoUrl}}';
const LOGO_CID = 'logo-cafe-una';

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
  private readonly actualizacionDonacionTemplatePath = path.join(
    process.cwd(),
    'Templates',
    'Email',
    'actualizacion-donacion.html',
  );
  private readonly alertaStockTemplatePath = path.join(
    process.cwd(),
    'Templates',
    'Email',
    'alerta-stock.html',
  );

  private logoCache: { png: Buffer | null; vence: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
  ) {}

  /** Logo con letras oscuras (fondo blanco) que la administración define en el navbar o footer. */
  private async logoCorreoUrl(): Promise<string> {
    let url = '';
    try {
      const filas: Array<{ LogoUrl: string | null }> | undefined = await this.dataSource?.query(
        `SELECT "LogoUrl" FROM informacion_navbar WHERE COALESCE("LogoUrl", '') <> ''
         UNION ALL
         SELECT "LogoUrl" FROM informacion_footer WHERE COALESCE("LogoUrl", '') <> ''
         LIMIT 1`,
      );
      url = filas?.[0]?.LogoUrl?.trim() || '';
    } catch (error) {
      this.logger.warn(
        `No se pudo leer el logo para correos: ${error instanceof Error ? error.message : error}`,
      );
    }
    return url;
  }

  /** Gmail y Outlook no muestran bien WebP enlazado: el logo viaja adjunto en PNG. */
  private async logoCorreoPng(): Promise<Buffer | null> {
    if (this.logoCache && this.logoCache.vence > Date.now()) return this.logoCache.png;
    let png: Buffer | null = null;
    const url = await this.logoCorreoUrl();
    if (url) {
      try {
        const respuesta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const original = Buffer.from(await respuesta.arrayBuffer());
        png = await sharp(original).resize({ width: 400, withoutEnlargement: true }).png().toBuffer();
      } catch (error) {
        this.logger.warn(
          `No se pudo preparar el logo para correos (${url}): ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    this.logoCache = { png, vence: Date.now() + (png ? 10 * 60_000 : 60_000) };
    return png;
  }

  private async aplicarLogo(
    html: string,
  ): Promise<{ html: string; adjunto: { filename: string; content: Buffer; cid: string; contentType: string } | null }> {
    if (!html.includes(LOGO_PLACEHOLDER)) return { html, adjunto: null };
    const png = await this.logoCorreoPng();
    if (png) {
      return {
        html: html.replaceAll(LOGO_PLACEHOLDER, `cid:${LOGO_CID}`),
        adjunto: { filename: 'logo-cafe-una.png', content: png, cid: LOGO_CID, contentType: 'image/png' },
      };
    }
    return {
      html: html.replace(
        /<img[^>]*\{\{logoUrl\}\}[^>]*>/g,
        '<p style="margin:0;font-size:22px;font-weight:700;color:#C41E3A;">Café UNA</p>',
      ),
      adjunto: null,
    };
  }

  async enviarCodigoRegistro(
    destinatario: string,
    nombre: string,
    codigo: string,
    enlaceVerificacion?: string,
  ): Promise<boolean> {
    const notaBase =
      `El código tiene ${CODIGO_DIGITOS} dígitos y vence en ${TOKEN_LIFETIME_MINUTES} minutos. Si no creaste esta cuenta, ignorá este correo.`;
    const nota = enlaceVerificacion
      ? `${notaBase} También podés abrir este enlace: ${enlaceVerificacion}`
      : notaBase;
    const mensaje = enlaceVerificacion
      ? 'Usá este código o abrí el enlace para activar tu cuenta de cliente en Café UNA:'
      : 'Usá este código para completar tu registro en Café UNA:';
    const contenido = await this.buildCodeEmail(
      nombre,
      'Verifica tu cuenta',
      mensaje,
      codigo,
      nota,
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
      `El código tiene ${CODIGO_DIGITOS} dígitos y vence en ${TOKEN_LIFETIME_MINUTES} minutos. Si no solicitaste este cambio, ignorá este correo.`,
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
      `El código tiene ${CODIGO_DIGITOS} dígitos y vence en ${TOKEN_LIFETIME_MINUTES} minutos. Si no solicitaste este cambio, ignorá este correo.`,
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

  async enviarActualizacionEstadoDonacion(
    destinatario: string,
    datos: {
      nombre: string;
      categoria: string;
      material?: string;
      estado: string;
      fechaActualizacion: string;
      motivoRechazo?: string | null;
    },
  ): Promise<boolean> {
    return this.enviar(
      destinatario,
      'Actualización de su solicitud de donación - Café UNA',
      await this.buildActualizacionDonacionEmail(datos),
    );
  }

  async enviarConfirmacionVisitaGrupal(
    destinatario: string,
    datos: {
      nombreEncargado: string;
      fechaVisita: string;
      cantidad: number;
    },
  ): Promise<boolean> {
    const sede = this.sedeFinca();
    const html = this.plantillaInstitucional({
      saludo: `Hola, ${datos.nombreEncargado}`,
      titulo: 'Solicitud de visita grupal recibida',
      cuerpo: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3a4a6b;">Su solicitud para una visita grupal de <strong>${datos.cantidad} personas</strong> el día <strong>${this.escapeHtml(datos.fechaVisita)}</strong> fue recibida en Café UNA.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f9fc" style="margin:0 0 16px;background-color:#f7f9fc;border:1px solid #dfe6f0;">
          <tr>
            <td style="padding:16px 20px;border-left:4px solid #0D1B3E;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#3a4a6b;">El registro está en estado <strong>Pendiente</strong>. El equipo coordinador evaluará la disponibilidad y se comunicará con usted.</p>
            </td>
          </tr>
        </table>
        ${this.bloqueSedeHtml(sede, `Las visitas se realizan en <strong>${this.escapeHtml(sede.nombre)}</strong>.`)}`,
    });
    return this.enviar(
      destinatario,
      'Solicitud de Visita Grupal recibida - Café UNA',
      html,
    );
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
    const estadoNormalizado = datos.estado.trim().toLowerCase();
    const esRechazada = ['rechazada', 'rechazado'].includes(estadoNormalizado);
    const esAprobada = ['aprobada', 'aprobado'].includes(estadoNormalizado);

    const bloqueMotivo =
      esRechazada && datos.motivoRechazo?.trim()
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background-color:#fdf2f4;border:1px solid #f3d0d6;">
            <tr>
              <td style="padding:16px 20px;border-left:4px solid #C41E3A;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#0D1B3E;">
                  <strong>Motivo u observaciones:</strong><br>${this.escapeHtml(datos.motivoRechazo.trim())}
                </p>
              </td>
            </tr>
          </table>`
        : '';
    const sede = this.sedeFinca();
    const bloqueAprobada = esAprobada
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background-color:#f7f9fc;border:1px solid #dfe6f0;">
            <tr>
              <td style="padding:16px 20px;border-left:4px solid #0D1B3E;">
                <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3a4a6b;">
                  <strong>¡Visita aprobada!</strong><br>
                  Te esperamos en <strong>${this.escapeHtml(sede.nombre)}</strong>. Presentate 10 minutos antes de la hora acordada.
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;">
                  <a href="${this.escapeHtml(sede.mapsUrl)}" style="color:#0D1B3E;font-weight:700;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Ver ubicación en Google Maps</a>
                </p>
              </td>
            </tr>
          </table>`
      : '';

    const html = this.plantillaInstitucional({
      saludo: `Hola, ${datos.nombreEncargado}`,
      titulo: 'Actualización de solicitud de visita grupal',
      cuerpo: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3a4a6b;">Su solicitud para la visita del <strong>${this.escapeHtml(datos.fechaVisita)}</strong> cambió al estado <strong>${this.escapeHtml(datos.estado)}</strong>.</p>
        ${bloqueAprobada}
        ${bloqueMotivo}
        <p style="margin:16px 0 0;font-size:13px;line-height:1.7;color:#6b7a99;">Fecha de actualización: ${this.escapeHtml(datos.fechaActualizacion)}</p>`,
    });
    return this.enviar(
      destinatario,
      `Actualización de Visita Grupal (${datos.estado}) - Café UNA`,
      html,
    );
  }

  async enviarConfirmacionSolicitudDocumento(
    destinatario: string,
    datos: {
      nombreSolicitante: string;
      tituloDocumento: string;
    },
  ): Promise<boolean> {
    const html = this.plantillaInstitucional({
      saludo: `Hola, ${datos.nombreSolicitante}`,
      titulo: 'Solicitud de documento recibida',
      cuerpo: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3a4a6b;">Hemos recibido correctamente tu solicitud para el siguiente material:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f9fc" style="background-color:#f7f9fc;border:1px solid #dfe6f0;">
          <tr>
            <td style="padding:16px 20px;border-left:4px solid #0D1B3E;">
              <p style="margin:0;font-size:15px;font-weight:700;line-height:1.5;color:#0D1B3E;">${this.escapeHtml(datos.tituloDocumento)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#3a4a6b;">
          Tu solicitud quedó en estado <strong>Pendiente</strong>. El equipo administrativo revisará la disponibilidad del documento y te avisaremos cuando sea atendida.
        </p>`,
    });
    return this.enviar(
      destinatario,
      'Solicitud de documentación recibida - Café UNA',
      html,
    );
  }

  async enviarActualizacionSolicitudDocumento(
    destinatario: string,
    datos: {
      nombreSolicitante: string;
      tituloDocumento: string;
      estado: string;
      notasRespuesta?: string | null;
      tieneArchivoAdjunto?: boolean;
      enlaceDescarga?: string | null;
    },
  ): Promise<boolean> {
    const estadoNorm = datos.estado.trim().toLowerCase();
    const esRechazada = estadoNorm === 'rechazada';
    const colorBorde = esRechazada ? '#C41E3A' : '#0D1B3E';
    const fondoBadge = esRechazada ? '#fdf2f4' : '#f7f9fc';
    const bordeCaja = esRechazada ? '#f3d0d6' : '#dfe6f0';

    const html = this.plantillaInstitucional({
      saludo: `Hola, ${datos.nombreSolicitante}`,
      titulo: 'Actualización de tu solicitud',
      cuerpo: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3a4a6b;">Tu solicitud referente al documento:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f9fc" style="margin:0 0 16px;background-color:#f7f9fc;border:1px solid #dfe6f0;">
          <tr>
            <td style="padding:16px 20px;border-left:4px solid #0D1B3E;">
              <p style="margin:0;font-size:15px;font-weight:700;line-height:1.5;color:#0D1B3E;">${this.escapeHtml(datos.tituloDocumento)}</p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${fondoBadge}" style="background-color:${fondoBadge};border:1px solid ${bordeCaja};">
          <tr>
            <td style="padding:16px 20px;border-left:4px solid ${colorBorde};">
              <p style="margin:0;font-size:15px;font-weight:700;line-height:1.5;color:${colorBorde};">Estado actual: ${this.escapeHtml(datos.estado)}</p>
            </td>
          </tr>
        </table>
        ${datos.notasRespuesta ? `
        <p style="margin:16px 0 6px;font-size:14px;font-weight:700;color:#0D1B3E;">Observaciones</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3a4a6b;">${this.escapeHtml(datos.notasRespuesta)}</p>` : ''}
        ${datos.tieneArchivoAdjunto ? `
        <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#3a4a6b;">El archivo solicitado quedó disponible en la plataforma de Café UNA.</p>` : ''}
        ${datos.enlaceDescarga ? `
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;">
          <a href="${this.escapeHtml(datos.enlaceDescarga)}" style="color:#0D1B3E;font-weight:700;text-decoration:underline;">Descargar el documento</a>
        </p>` : ''}`,
    });
    return this.enviar(
      destinatario,
      `Actualización de solicitud de documento (${datos.estado}) - Café UNA`,
      html,
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

    return this.plantillaInstitucional({
      saludo: 'Hola',
      titulo: 'Comprobante de compra',
      cuerpo: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f9fc" style="margin:0 0 16px;background-color:#f7f9fc;border:1px solid #dfe6f0;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Comprobante:</strong> ${numeroComprobante}</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Fecha y hora:</strong> ${this.escapeHtml(fechaFormateada)}</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Punto de venta:</strong> ${this.escapeHtml(datos.puntoVenta || 'Punto presencial')}</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Atendido por:</strong> ${this.escapeHtml(datos.vendedor || 'Personal Café UNA')}</p>
            ${datos.clienteNombre ? `<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Cliente:</strong> ${this.escapeHtml(datos.clienteNombre)}</p>` : ''}
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Método de pago:</strong> ${this.escapeHtml(datos.metodoPago || 'Efectivo')}</p>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <thead>
            <tr>
              <th align="left" style="padding:8px 0;font-size:13px;color:#5f6b82;border-bottom:1px solid #e6eaf2;">Producto</th>
              <th align="center" style="padding:8px 0;font-size:13px;color:#5f6b82;border-bottom:1px solid #e6eaf2;">Cant.</th>
              <th align="right" style="padding:8px 0;font-size:13px;color:#5f6b82;border-bottom:1px solid #e6eaf2;">Unitario</th>
              <th align="right" style="padding:8px 0;font-size:13px;color:#5f6b82;border-bottom:1px solid #e6eaf2;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <p style="margin:12px 0 4px;font-size:14px;line-height:1.6;color:#3a4a6b;text-align:right;">Subtotal sin IVA: ${fmt(subtotalSinIva)}</p>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3a4a6b;text-align:right;">IVA 13%: ${fmt(ivaMonto)}</p>
        <p style="margin:0;font-size:16px;line-height:1.6;font-weight:700;color:#C41E3A;text-align:right;">Total: ${fmt(datos.total)}</p>
        ${
          datos.notas?.trim()
            ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Notas:</strong> ${this.escapeHtml(datos.notas.trim())}</p>`
            : ''
        }`,
    });
  }

  async enviar(
    destinatario: string,
    subject: string,
    htmlBody: string,
    textBody?: string,
    attachments?: Array<{
      filename: string;
      content?: Buffer | string;
      path?: string;
      contentType?: string;
    }>,
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

      const conLogo = await this.aplicarLogo(htmlBody);
      const adjuntos = [...(attachments ?? []), ...(conLogo.adjunto ? [conLogo.adjunto] : [])];
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: destinatario.trim(),
        subject,
        html: conLogo.html,
        text: textBody || undefined,
        attachments: adjuntos.length > 0 ? adjuntos : undefined,
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

  private plantillaInstitucional(datos: {
    saludo: string;
    titulo: string;
    cuerpo: string;
  }): string {
    const saludo = this.escapeHtml(datos.saludo);
    const titulo = this.escapeHtml(datos.titulo);
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    @media (prefers-color-scheme: dark) {
      .email-outer, .email-outer td { background-color: #f4f5f8 !important; }
      .email-card, .email-card td, .email-logo, .email-logo td, .email-content, .email-content td, .email-footer, .email-footer td, .logo-bg { background-color: #ffffff !important; }
      .text-muted { color: #5f6b82 !important; }
      .text-title { color: #0D1B3E !important; }
      .text-note { color: #6b7a99 !important; }
      .text-brand { color: #C41E3A !important; }
      .text-footer { color: #8a96ad !important; }
      .bar-red { background-color: #C41E3A !important; }
    }
  </style>
</head>
<body class="email-outer" style="margin:0;padding:0;background-color:#f4f5f8 !important;font-family:Arial,Helvetica,sans-serif;color-scheme:light only;">
  <table role="presentation" class="email-outer" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f8" style="background-color:#f4f5f8 !important;padding:32px 16px;">
    <tr>
      <td align="center" bgcolor="#f4f5f8" style="background-color:#f4f5f8 !important;">
        <table role="presentation" class="email-card" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:560px;background-color:#ffffff !important;border:1px solid #e6eaf2;">
          <tr>
            <td class="email-logo logo-bg" align="center" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:28px 20px 16px;">
              <img src="{{logoUrl}}" alt="Café UNA" width="200" style="display:block;width:200px;max-width:200px;height:auto;border:0;margin:0 auto;background-color:#ffffff;" />
            </td>
          </tr>
          <tr>
            <td class="bar-red" bgcolor="#C41E3A" style="background-color:#C41E3A !important;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-content" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:32px 28px 8px;">
              <p class="text-muted" style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#5f6b82 !important;">${saludo}</p>
              <h1 class="text-title" style="margin:0 0 16px;font-size:24px;line-height:1.35;color:#0D1B3E !important;font-weight:700;">${titulo}</h1>
              ${datos.cuerpo}
            </td>
          </tr>
          <tr>
            <td class="email-content" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:8px 28px 24px;">
              <p class="text-note" style="margin:0;font-size:13px;line-height:1.7;color:#6b7a99 !important;">Este es un correo automático de Café UNA. No es necesario responderlo.</p>
            </td>
          </tr>
          <tr>
            <td class="email-footer" align="center" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:16px 28px 28px;border-top:1px solid #e8edf5;">
              <p class="text-brand" style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#C41E3A !important;">Café UNA</p>
              <p class="text-footer" style="margin:0;font-size:12px;line-height:1.6;color:#8a96ad !important;">Universidad Nacional, Costa Rica</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private sedeFinca(): SedeFinca {
    return resolverSedeFinca(this.config);
  }

  private bloqueSedeHtml(sede: SedeFinca, mensajeHtml: string): string {
    return `<p style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #0D1B3E; color: #334155; line-height: 1.6;">
        ${mensajeHtml}<br>
        <a href="${this.escapeHtml(sede.mapsUrl)}" style="color:#0D1B3E;font-weight:700;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Ver ubicación en Google Maps</a>
      </p>`;
  }

  private async buildVoluntariadoEmail(nombre: string): Promise<string> {
    const saludo = nombre?.trim()
      ? `Hola, ${this.escapeHtml(nombre)}`
      : 'Hola';
    const sede = this.sedeFinca();
    const bloqueSede = this.bloqueSedeHtml(
      sede,
      `El voluntariado se realiza en <strong>${this.escapeHtml(sede.nombre)}</strong>.`,
    );

    try {
      const template = await fs.readFile(this.voluntariadoTemplatePath, 'utf8');
      return template
        .replaceAll('{{saludo}}', saludo)
        .replaceAll('{{bloqueSede}}', bloqueSede);
    } catch {
      return this.plantillaInstitucional({
        saludo: nombre?.trim() ? `Hola, ${nombre.trim()}` : 'Hola',
        titulo: 'Solicitud de voluntariado recibida',
        cuerpo: `
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3a4a6b;">Su solicitud de voluntariado fue <strong>recibida correctamente</strong> y está siendo revisada por el equipo de Café UNA.</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3a4a6b;">Recibirá información sobre el resultado de su solicitud en su correo electrónico.</p>
          ${bloqueSede}`,
      });
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
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background-color:#fdf2f4;border:1px solid #f3d0d6;">
            <tr>
              <td style="padding:16px 20px;border-left:4px solid #C41E3A;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#0D1B3E;">
                  <strong>Motivo del rechazo:</strong><br>${this.escapeHtml(motivo)}
                </p>
              </td>
            </tr>
          </table>`
        : '';

    const sede = this.sedeFinca();
    const bloqueInstruccionesAprobacion =
      estadoNormalizado === 'aprobado'
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background-color:#f7f9fc;border:1px solid #dfe6f0;">
            <tr>
              <td style="padding:16px 20px;border-left:4px solid #0D1B3E;">
                <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3a4a6b;">
                  <strong>Próximos pasos</strong><br>
                  Su solicitud fue aprobada. Te esperamos en <strong>${this.escapeHtml(sede.nombre)}</strong>. El equipo de Café UNA coordinará los detalles de inicio.
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;">
                  <a href="${this.escapeHtml(sede.mapsUrl)}" style="color:#0D1B3E;font-weight:700;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Ver ubicación en Google Maps</a>
                </p>
              </td>
            </tr>
          </table>`
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
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f5f8" style="background-color:#f4f5f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #e6eaf2;">
          <tr>
            <td align="center" style="padding:28px 20px 16px;">
              <img src="{{logoUrl}}" alt="Café UNA" width="200" style="display:block;width:200px;max-width:200px;height:auto;border:0;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td bgcolor="#C41E3A" style="background-color:#C41E3A;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;">
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#5f6b82;">${saludo}</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.35;color:#0D1B3E;font-weight:700;">Actualización de su solicitud de voluntariado</h1>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#3a4a6b;">Le informamos que su solicitud de voluntariado ha sido actualizada.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f9fc" style="background-color:#f7f9fc;border:1px solid #dfe6f0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Tipo de voluntariado:</strong> ${this.escapeHtml(datos.tipoVoluntariado || 'No indicado')}</p>
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Período:</strong> ${this.escapeHtml(datos.periodo || 'No indicado')}</p>
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Nuevo estado:</strong> ${this.escapeHtml(datos.estado)}</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Fecha de actualización:</strong> ${this.escapeHtml(datos.fechaActualizacion)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px;">
              ${bloqueMotivoRechazo}
              ${bloqueInstruccionesAprobacion}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 28px 28px;border-top:1px solid #e8edf5;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#C41E3A;">Café UNA</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#8a96ad;">Universidad Nacional, Costa Rica</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
  }

  private async buildActualizacionDonacionEmail(datos: {
    nombre: string;
    categoria: string;
    material?: string;
    estado: string;
    fechaActualizacion: string;
    motivoRechazo?: string | null;
  }): Promise<string> {
    const saludo = datos.nombre?.trim()
      ? `Hola, ${this.escapeHtml(datos.nombre)}`
      : 'Hola';
    const estadoNormalizado = datos.estado
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const esRechazada =
      estadoNormalizado === 'rechazada' || estadoNormalizado === 'rechazado';
    const esAceptada =
      estadoNormalizado === 'aceptada' ||
      estadoNormalizado === 'aceptado' ||
      estadoNormalizado === 'aprobada' ||
      estadoNormalizado === 'aprobado';
    const motivo = datos.motivoRechazo?.trim();

    const bloqueMotivoRechazo =
      esRechazada && motivo
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background-color:#fdf2f4;border:1px solid #f3d0d6;">
            <tr>
              <td style="padding:16px 20px;border-left:4px solid #C41E3A;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#0D1B3E;">
                  <strong>Motivo del rechazo:</strong><br>${this.escapeHtml(motivo)}
                </p>
              </td>
            </tr>
          </table>`
        : esRechazada
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background-color:#fdf2f4;border:1px solid #f3d0d6;">
            <tr>
              <td style="padding:16px 20px;border-left:4px solid #C41E3A;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#0D1B3E;">
                  Lamentamos informarle que, en esta ocasión, no es posible recibir la donación ofrecida. Agradecemos su interés en apoyar el proyecto.
                </p>
              </td>
            </tr>
          </table>`
          : '';

    const sede = this.sedeFinca();
    const bloqueInstruccionesAceptacion = esAceptada
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background-color:#f7f9fc;border:1px solid #dfe6f0;">
            <tr>
              <td style="padding:16px 20px;border-left:4px solid #0D1B3E;">
                <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3a4a6b;">
                  <strong>Próximos pasos</strong><br>
                  Su solicitud de donación fue aceptada. Si la entrega es presencial, te esperamos en <strong>${this.escapeHtml(sede.nombre)}</strong>. Si solicitaste recolección, el personal coordinará el retiro.
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;">
                  <a href="${this.escapeHtml(sede.mapsUrl)}" style="color:#0D1B3E;font-weight:700;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Ver ubicación en Google Maps</a>
                </p>
              </td>
            </tr>
          </table>`
      : '';

    try {
      const template = await fs.readFile(
        this.actualizacionDonacionTemplatePath,
        'utf8',
      );
      return template
        .replaceAll('{{saludo}}', saludo)
        .replaceAll(
          '{{categoria}}',
          this.escapeHtml(datos.categoria || 'No indicado'),
        )
        .replaceAll(
          '{{material}}',
          this.escapeHtml(datos.material?.trim() || 'No indicado'),
        )
        .replaceAll('{{estado}}', this.escapeHtml(datos.estado))
        .replaceAll(
          '{{fechaActualizacion}}',
          this.escapeHtml(datos.fechaActualizacion),
        )
        .replaceAll('{{bloqueMotivoRechazo}}', bloqueMotivoRechazo)
        .replaceAll(
          '{{bloqueInstruccionesAceptacion}}',
          bloqueInstruccionesAceptacion,
        );
    } catch {
      return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f5f8" style="background-color:#f4f5f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #e6eaf2;">
          <tr>
            <td align="center" style="padding:28px 20px 16px;">
              <img src="{{logoUrl}}" alt="Café UNA" width="200" style="display:block;width:200px;max-width:200px;height:auto;border:0;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td bgcolor="#C41E3A" style="background-color:#C41E3A;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;">
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#5f6b82;">${saludo}</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.35;color:#0D1B3E;font-weight:700;">Actualización de su solicitud de donación</h1>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#3a4a6b;">Le informamos que su solicitud de donación material ha sido actualizada.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f9fc" style="background-color:#f7f9fc;border:1px solid #dfe6f0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Categoría:</strong> ${this.escapeHtml(datos.categoria || 'No indicado')}</p>
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Material o artículo:</strong> ${this.escapeHtml(datos.material?.trim() || 'No indicado')}</p>
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Nuevo estado:</strong> ${this.escapeHtml(datos.estado)}</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#3a4a6b;"><strong>Fecha de actualización:</strong> ${this.escapeHtml(datos.fechaActualizacion)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px;">
              ${bloqueMotivoRechazo}
              ${bloqueInstruccionesAceptacion}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 28px 28px;border-top:1px solid #e8edf5;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#C41E3A;">Café UNA</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#8a96ad;">Universidad Nacional, Costa Rica</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
  }
}
