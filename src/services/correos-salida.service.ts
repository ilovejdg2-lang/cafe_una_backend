import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThanOrEqual, Repository } from 'typeorm';

import { EmailService } from '../common/email.service';
import { CorreoSalida } from '../entities/correo-salida.entity';

const MAX_INTENTOS = 5;
const ESPERA_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000];

export type CorreoEncolado = {
  clave: string;
  destinatario: string;
  asunto: string;
  html: string;
  texto: string;
};

@Injectable()
export class CorreosSalidaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CorreosSalidaService.name);
  private temporizador: NodeJS.Timeout | null = null;
  private procesando = false;

  constructor(
    @InjectRepository(CorreoSalida)
    private readonly repo: Repository<CorreoSalida>,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    this.temporizador = setInterval(() => {
      void this.procesarPendientes();
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  async encolar(manager: EntityManager, correo: CorreoEncolado): Promise<void> {
    const repo = manager.getRepository(CorreoSalida);
    const existe = await repo.findOne({ where: { ClaveUnica: correo.clave } });
    if (existe) return;
    await repo.save(
      repo.create({
        ClaveUnica: correo.clave,
        Destinatario: correo.destinatario,
        Asunto: correo.asunto,
        Html: correo.html,
        Texto: correo.texto,
        Estado: 'pendiente',
        Intentos: 0,
        ProximoIntento: new Date(),
        UltimoError: null,
        EnviadoEn: null,
      }),
    );
  }

  async intentarClave(clave: string): Promise<'enviado' | 'pendiente'> {
    const fila = await this.repo.findOne({ where: { ClaveUnica: clave } });
    if (!fila) return 'pendiente';
    if (fila.Estado === 'enviado') return 'enviado';
    const ok = await this.enviarFila(fila);
    return ok ? 'enviado' : 'pendiente';
  }

  async procesarPendientes(): Promise<void> {
    if (this.procesando) return;
    this.procesando = true;
    try {
      const pendientes = await this.repo.find({
        where: {
          Estado: 'pendiente',
          ProximoIntento: LessThanOrEqual(new Date()),
        },
        order: { Id: 'ASC' },
        take: 20,
      });
      for (const fila of pendientes) {
        await this.enviarFila(fila);
      }
    } catch (error) {
      this.logger.warn(`No se pudo revisar la cola de correos: ${error}`);
    } finally {
      this.procesando = false;
    }
  }

  private async enviarFila(fila: CorreoSalida): Promise<boolean> {
    if (fila.Estado === 'enviado') return true;
    try {
      const ok = await this.emailService.enviar(
        fila.Destinatario,
        fila.Asunto,
        fila.Html,
        fila.Texto,
      );
      if (!ok) {
        await this.registrarFallo(fila, 'El servicio de correo no confirmó el envío.');
        return false;
      }
      fila.Estado = 'enviado';
      fila.EnviadoEn = new Date();
      fila.UltimoError = null;
      fila.Intentos += 1;
      await this.repo.save(fila);
      return true;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error de envío';
      await this.registrarFallo(fila, mensaje);
      return false;
    }
  }

  private async registrarFallo(fila: CorreoSalida, mensaje: string): Promise<void> {
    const intentos = fila.Intentos + 1;
    fila.Intentos = intentos;
    fila.UltimoError = mensaje.slice(0, 500);
    if (intentos >= MAX_INTENTOS) {
      fila.Estado = 'error';
    } else {
      fila.Estado = 'pendiente';
      const espera = ESPERA_MS[Math.min(intentos - 1, ESPERA_MS.length - 1)];
      fila.ProximoIntento = new Date(Date.now() + espera);
    }
    await this.repo.save(fila);
    this.logger.warn(
      `Correo ${fila.ClaveUnica} pendiente (intento ${intentos}): ${mensaje}`,
    );
  }
}
