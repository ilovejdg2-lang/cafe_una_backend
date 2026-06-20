import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../common/email.service';
import { UsuarioValidacion } from '../common/usuario-validacion';
import { UsuarioCreacionPendiente } from '../entities/usuario-creacion-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import { UsuariosService } from '../usuarios/usuarios.service';

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const EMAIL_COOLDOWN_MINUTES = 3;
const MENSAJE_ESPERA_CORREO =
  'No se puede mandar un correo seguido. Espera 3 minutos.';

@Injectable()
export class UsuariosAdminService {
  constructor(
    @InjectRepository(UsuarioCreacionPendiente)
    private readonly pendientesRepo: Repository<UsuarioCreacionPendiente>,
    private readonly usuariosService: UsuariosService,
    private readonly emailService: EmailService,
  ) {}

  async solicitarCreacionUsuario(request: {
    Nombre: string;
    Correo: string;
    PasswordHash: string;
    Roles?: string[];
  }): Promise<{ EmailEnviado: boolean; MensajeError?: string }> {
    const nombre = request.Nombre.trim();
    const correo = request.Correo.trim().toLowerCase();
    const password = request.PasswordHash;

    if (!nombre) throw new Error('El nombre es obligatorio.');
    UsuarioValidacion.validarNombre(nombre);
    if (!correo) throw new Error('El correo es obligatorio.');
    UsuarioValidacion.validarPassword(password);

    if (await this.usuariosService.existeCorreo(correo)) {
      throw new Error('Ya existe una cuenta con ese correo.');
    }
    if (await this.usuariosService.existeNombre(nombre)) {
      throw new Error('Ya existe una cuenta con ese nombre de usuario.');
    }

    const roles =
      !request.Roles || request.Roles.length === 0
        ? ['Usuario']
        : [...request.Roles];
    const now = new Date();

    const pendienteActivo = await this.pendientesRepo
      .createQueryBuilder('p')
      .where('p.Usado = false AND p.ExpiraEnUtc > :now AND LOWER(p.Correo) = :correo', {
        now,
        correo,
      })
      .orderBy('p.ExpiraEnUtc', 'DESC')
      .getOne();

    if (pendienteActivo) {
      if (pendienteActivo.Nombre.toLowerCase() !== nombre.toLowerCase()) {
        throw new Error('Ese correo ya tiene una creación en proceso.');
      }
      const mensajeEspera = this.obtenerMensajeEsperaCorreo(pendienteActivo.ExpiraEnUtc);
      if (mensajeEspera) {
        return { EmailEnviado: false, MensajeError: mensajeEspera };
      }
    }

    await this.pendientesRepo
      .createQueryBuilder()
      .delete()
      .where(
        'Usado = true OR ExpiraEnUtc <= :now OR LOWER(Correo) = :correo OR LOWER(Nombre) = :nombre',
        { now, correo, nombre: nombre.toLowerCase() },
      )
      .execute();

    const token = this.generarCodigo();
    await this.pendientesRepo.save(
      this.pendientesRepo.create({
        Token: token,
        Correo: correo,
        Nombre: nombre,
        PasswordHash: password,
        Roles: roles,
        ExpiraEnUtc: new Date(now.getTime() + TOKEN_LIFETIME_MS),
        Usado: false,
      }),
    );

    const emailEnviado = await this.emailService.enviarCodigoCambioCorreo(
      correo,
      nombre,
      token,
    );
    return { EmailEnviado: emailEnviado };
  }

  async confirmarCreacionUsuario(request: {
    Correo: string;
    Token: string;
  }): Promise<Usuario> {
    const correo = request.Correo.trim().toLowerCase();
    const codigo = request.Token.trim();

    if (!correo || !codigo) {
      throw new Error('Correo y código son obligatorios.');
    }

    const now = new Date();
    const entry = await this.pendientesRepo
      .createQueryBuilder('p')
      .where(
        'p.Usado = false AND p.ExpiraEnUtc > :now AND LOWER(p.Correo) = :correo AND p.Token = :codigo',
        { now, correo, codigo },
      )
      .getOne();

    if (!entry) throw new Error('Código inválido o expirado.');
    if (await this.usuariosService.existeCorreo(correo)) {
      throw new Error('Ya existe una cuenta con ese correo.');
    }
    if (await this.usuariosService.existeNombre(entry.Nombre)) {
      throw new Error('Ya existe una cuenta con ese nombre de usuario.');
    }

    entry.Usado = true;
    await this.pendientesRepo.save(entry);

    return this.usuariosService.crear({
      Nombre: entry.Nombre,
      Correo: entry.Correo,
      PasswordHash: entry.PasswordHash,
      Roles: entry.Roles,
    });
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
