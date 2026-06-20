import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../common/email.service';
import { UsuarioValidacion } from '../common/usuario-validacion';
import { CambioCorreoPendiente } from '../entities/cambio-correo-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import { UsuariosService, UsuarioPerfilResponse } from '../usuarios/usuarios.service';

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const EMAIL_COOLDOWN_MINUTES = 3;
const MENSAJE_ESPERA_CORREO =
  'No se puede mandar un correo seguido. Espera 3 minutos.';

@Injectable()
export class PerfilService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(CambioCorreoPendiente)
    private readonly cambiosRepo: Repository<CambioCorreoPendiente>,
    private readonly usuariosService: UsuariosService,
    private readonly emailService: EmailService,
  ) {}

  async solicitarCambioCorreo(
    usuarioId: number,
    nuevoCorreo: string,
    passwordActual: string,
  ): Promise<{ EmailEnviado: boolean; MensajeError?: string }> {
    const correo = nuevoCorreo.trim().toLowerCase();
    if (!correo) throw new Error('El correo nuevo es obligatorio.');

    const usuario = await this.usuariosRepo.findOne({ where: { Id: usuarioId } });
    if (!usuario) throw new Error('Usuario no encontrado.');

    UsuarioValidacion.validarPasswordActual(usuario.PasswordHash, passwordActual);

    if (usuario.Correo.toLowerCase() === correo) {
      throw new Error('Ese ya es su correo actual.');
    }
    if (await this.usuariosService.existeCorreo(correo)) {
      throw new Error('Ya existe una cuenta con ese correo.');
    }

    const now = new Date();
    const pendienteActivo = await this.cambiosRepo
      .createQueryBuilder('c')
      .where(
        'c.Usado = false AND c.ExpiraEnUtc > :now AND c.UsuarioId = :usuarioId AND LOWER(c.NuevoCorreo) = :correo',
        { now, usuarioId, correo },
      )
      .orderBy('c.ExpiraEnUtc', 'DESC')
      .getOne();

    if (pendienteActivo) {
      const mensajeEspera = this.obtenerMensajeEsperaCorreo(pendienteActivo.ExpiraEnUtc);
      if (mensajeEspera) {
        return { EmailEnviado: false, MensajeError: mensajeEspera };
      }
    }

    await this.cambiosRepo
      .createQueryBuilder()
      .delete()
      .where(
        'UsuarioId = :usuarioId AND (Usado = true OR ExpiraEnUtc <= :now OR LOWER(NuevoCorreo) = :correo)',
        { usuarioId, now, correo },
      )
      .execute();

    const token = this.generarCodigo();
    await this.cambiosRepo.save(
      this.cambiosRepo.create({
        UsuarioId: usuarioId,
        NuevoCorreo: correo,
        Token: token,
        ExpiraEnUtc: new Date(now.getTime() + TOKEN_LIFETIME_MS),
        Usado: false,
      }),
    );

    const emailEnviado = await this.emailService.enviarCodigoCambioCorreo(
      correo,
      usuario.Nombre,
      token,
    );
    return { EmailEnviado: emailEnviado };
  }

  async confirmarCambioCorreo(
    usuarioId: number,
    nuevoCorreo: string,
    token: string,
  ): Promise<UsuarioPerfilResponse> {
    const correo = nuevoCorreo.trim().toLowerCase();
    const codigo = token.trim();

    if (!correo || !codigo) {
      throw new Error('Correo y código son obligatorios.');
    }

    const now = new Date();
    const entry = await this.cambiosRepo
      .createQueryBuilder('c')
      .where(
        'c.Usado = false AND c.ExpiraEnUtc > :now AND c.UsuarioId = :usuarioId AND LOWER(c.NuevoCorreo) = :correo AND c.Token = :codigo',
        { now, usuarioId, correo, codigo },
      )
      .getOne();

    if (!entry) throw new Error('Código inválido o expirado.');
    if (await this.usuariosService.existeCorreo(correo)) {
      throw new Error('Ya existe una cuenta con ese correo.');
    }

    const usuario = await this.usuariosRepo.findOne({ where: { Id: usuarioId } });
    if (!usuario) throw new Error('Usuario no encontrado.');

    entry.Usado = true;
    await this.cambiosRepo.save(entry);
    usuario.Correo = correo;
    await this.usuariosRepo.save(usuario);

    const perfil = await this.usuariosService.obtenerPerfil(usuarioId);
    if (!perfil) throw new Error('No se pudo actualizar el perfil.');
    return perfil;
  }

  private generarCodigo(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private obtenerMensajeEsperaCorreo(expiraEnUtc: Date): string | null {
    const segundosRestantes = Math.ceil(
      (expiraEnUtc.getTime() - Date.now()) / 1000,
    );
    if (segundosRestantes <= 0) return null;
    const minutosRestantes = Math.ceil(segundosRestantes / 60);
    if (minutosRestantes >= EMAIL_COOLDOWN_MINUTES) return null;
    return `${MENSAJE_ESPERA_CORREO} Faltan ${minutosRestantes} min.`;
  }
}
