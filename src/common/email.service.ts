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
    const fromName = this.config.get<string>('SMTP_FROM_NAME') ?? 'Cafe UNA';

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
}
