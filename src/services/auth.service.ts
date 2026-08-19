import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../common/email.service';
import {
  TOKEN_LIFETIME_MS,
  generarCodigoNumerico,
  generarCodigoRecuperacion,
  mensajeEsperaCorreo,
  mensajeEsperaCorreoPorMinutos,
} from '../common/verificacion-correo.util';
import { UsuarioValidacion } from '../common/usuario-validacion';
import { PasswordResetEntry } from '../entities/password-reset-entry.entity';
import { RegistroPendiente } from '../entities/registro-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import { verificarContrasena } from '../common/password.util';
import { UsuariosService } from './usuarios.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    @InjectRepository(RegistroPendiente)
    private readonly registrosRepo: Repository<RegistroPendiente>,
    @InjectRepository(PasswordResetEntry)
    private readonly passwordResetRepo: Repository<PasswordResetEntry>,
    private readonly emailService: EmailService,
  ) {}

  async autenticar(
    identifier: string,
    password: string,
  ): Promise<Usuario | null> {
    if (!identifier?.trim() || !password?.trim()) return null;

    const usuario = await this.usuariosService.obtenerPorNombreOCorreo(identifier);
    if (!usuario || usuario.Estado.toLowerCase() !== 'activo') return null;

    return (await verificarContrasena(password, usuario.PasswordHash))
      ? usuario
      : null;
  }

  async solicitarRegistro(request: {
    Nombre: string;
    Correo: string;
    Password: string;
  }): Promise<{ EmailEnviado: boolean; MensajeError?: string }> {
    const nombre = request.Nombre.trim();
    const correo = request.Correo.trim().toLowerCase();
    const password = request.Password;

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

    const now = new Date();
    const nombreNormalizado = nombre.toLowerCase();

    const pendienteActivo = await this.registrosRepo
      .createQueryBuilder('r')
      .where('r.Usado = false AND r.ExpiraEnUtc > :now AND LOWER(r.Correo) = :correo', {
        now,
        correo,
      })
      .orderBy('r.ExpiraEnUtc', 'DESC')
      .getOne();

    if (pendienteActivo) {
      if (pendienteActivo.Nombre.toLowerCase() !== nombre.toLowerCase()) {
        throw new Error('Ese correo ya tiene un registro en proceso.');
      }
      const mensajeEspera = mensajeEsperaCorreo(pendienteActivo.ExpiraEnUtc);
      if (mensajeEspera) {
        return { EmailEnviado: false, MensajeError: mensajeEspera };
      }
    }

    await this.registrosRepo
      .createQueryBuilder()
      .delete()
      .where(
        'Usado = true OR ExpiraEnUtc <= :now OR LOWER(Correo) = :correo OR LOWER(Nombre) = :nombre',
        { now, correo, nombre: nombreNormalizado },
      )
      .execute();

    const token = generarCodigoRecuperacion();
    await this.registrosRepo.save(
      this.registrosRepo.create({
        Token: token,
        Correo: correo,
        Nombre: nombre,
        PasswordHash: password,
        ExpiraEnUtc: new Date(now.getTime() + TOKEN_LIFETIME_MS),
        Usado: false,
      }),
    );

    const emailEnviado = await this.emailService.enviarCodigoRegistro(
      correo,
      nombre,
      token,
    );
    return { EmailEnviado: emailEnviado };
  }

  async confirmarRegistro(request: {
    Correo: string;
    Token: string;
  }): Promise<Usuario> {
    const correo = request.Correo.trim().toLowerCase();
    const token = request.Token.trim().toUpperCase();

    if (!correo || !token) {
      throw new Error('Correo y código son obligatorios.');
    }
    if (await this.usuariosService.existeCorreo(correo)) {
      throw new Error('Ya existe una cuenta con ese correo.');
    }

    const now = new Date();
    const entry = await this.registrosRepo
      .createQueryBuilder('r')
      .where(
        'r.Usado = false AND LOWER(r.Correo) = :correo AND UPPER(r.Token) = :token AND r.ExpiraEnUtc > :now',
        { correo, token, now },
      )
      .getOne();

    if (!entry) throw new Error('Código inválido o expirado.');
    if (await this.usuariosService.existeNombre(entry.Nombre)) {
      throw new Error('Ya existe una cuenta con ese nombre de usuario.');
    }

    const nombreNormalizado = entry.Nombre.toLowerCase();
    const nombreOcupado = await this.registrosRepo
      .createQueryBuilder('r')
      .where(
        'r.Usado = false AND r.ExpiraEnUtc > :now AND r.Id != :id AND LOWER(r.Nombre) = :nombre',
        { now, id: entry.Id, nombre: nombreNormalizado },
      )
      .getCount();
    if (nombreOcupado > 0) {
      throw new Error('Ese nombre de usuario ya está en uso.');
    }

    const usuario = await this.usuariosService.crear({
      Nombre: entry.Nombre,
      Correo: entry.Correo,
      PasswordHash: entry.PasswordHash,
      Roles: ['Usuario'],
    });

    entry.Usado = true;
    await this.registrosRepo.save(entry);
    return usuario;
  }

  async solicitarRecuperacion(request: {
    Identifier: string;
  }): Promise<{
    UsuarioEncontrado: boolean;
    EmailEnviado?: boolean;
    MensajeError?: string;
  }> {
    const identifier = request.Identifier.trim();
    if (!identifier) return { UsuarioEncontrado: false };

    const usuario = await this.usuariosService.obtenerPorNombreOCorreo(identifier);
    if (!usuario || usuario.Estado.toLowerCase() !== 'activo') {
      return { UsuarioEncontrado: false };
    }

    const now = new Date();
    const recuperacionActiva = await this.passwordResetRepo
      .createQueryBuilder('p')
      .where(
        'p.Usado = false AND p.ExpiraEnUtc > :now AND LOWER(p.Correo) = :correo',
        { now, correo: usuario.Correo.toLowerCase() },
      )
      .orderBy('p.ExpiraEnUtc', 'DESC')
      .getOne();

    if (recuperacionActiva) {
      const mensajeEspera = mensajeEsperaCorreo(
        recuperacionActiva.ExpiraEnUtc,
      );
      if (mensajeEspera) {
        return {
          UsuarioEncontrado: true,
          EmailEnviado: false,
          MensajeError: mensajeEspera,
        };
      }
    }

    await this.passwordResetRepo
      .createQueryBuilder()
      .delete()
      .where(
        'Usado = true OR ExpiraEnUtc <= :now OR LOWER(Correo) = :correo',
        { now, correo: usuario.Correo.toLowerCase() },
      )
      .execute();

    const token = generarCodigoRecuperacion();
    await this.passwordResetRepo.save(
      this.passwordResetRepo.create({
        Token: token,
        Correo: usuario.Correo,
        ExpiraEnUtc: new Date(now.getTime() + TOKEN_LIFETIME_MS),
        Usado: false,
      }),
    );

    const emailEnviado = await this.emailService.enviarCodigoRecuperacion(
      usuario.Correo,
      usuario.Nombre,
      token,
    );
    return { UsuarioEncontrado: true, EmailEnviado: emailEnviado };
  }

  async restablecerPassword(request: {
    Token: string;
    NuevaPassword: string;
  }): Promise<boolean> {
    const token = request.Token.trim().toUpperCase();
    const nuevaPassword = request.NuevaPassword;
    if (!token) return false;

    UsuarioValidacion.validarPassword(nuevaPassword);

    const now = new Date();
    const entry = await this.passwordResetRepo
      .createQueryBuilder('p')
      .where(
        'p.Usado = false AND UPPER(p.Token) = :token AND p.ExpiraEnUtc > :now',
        { token, now },
      )
      .getOne();
    if (!entry) return false;

    const actualizado = await this.usuariosService.actualizarPasswordPorCorreo(
      entry.Correo,
      nuevaPassword,
    );
    if (!actualizado) return false;

    entry.Usado = true;
    await this.passwordResetRepo.save(entry);
    return true;
  }
}
