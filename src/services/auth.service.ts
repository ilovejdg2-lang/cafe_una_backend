import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DatosClienteRegistro,
  validarCorreoCliente,
  validarDatosCliente,
  validarPasswordCliente,
} from '../common/cliente-registro.util';
import { EmailService } from '../common/email.service';
import { MENSAJE_CORREO_NO_ENVIADO } from '../common/respuesta-verificacion';
import {
  TOKEN_LIFETIME_MS,
  generarCodigoNumerico,
  mensajeEsperaCorreo,
} from '../common/verificacion-correo.util';
import { UsuarioValidacion, copiarUsuario } from '../common/usuario-validacion';
import { PasswordResetEntry } from '../entities/password-reset-entry.entity';
import { RegistroPendiente } from '../entities/registro-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import {
  hashearContrasena,
  necesitaRehash,
  verificarContrasena,
} from '../common/password.util';
import { UsuariosService } from './usuarios.service';

const MENSAJE_RECUPERACION_GENERICO =
  'Si existe una cuenta con esos datos, enviamos un código de recuperación al correo registrado.';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    @InjectRepository(RegistroPendiente)
    private readonly registrosRepo: Repository<RegistroPendiente>,
    @InjectRepository(PasswordResetEntry)
    private readonly passwordResetRepo: Repository<PasswordResetEntry>,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async autenticar(
    identifier: string,
    password: string,
  ): Promise<Usuario | null> {
    if (!identifier?.trim() || !password?.trim()) return null;

    const usuario = await this.usuariosService.obtenerPorNombreOCorreo(
      identifier,
      { incluirPassword: true },
    );
    if (!usuario || usuario.Estado.toLowerCase() !== 'activo') return null;
    if (!(await verificarContrasena(password, usuario.PasswordHash))) {
      return null;
    }

    if (necesitaRehash(usuario.PasswordHash)) {
      const nuevoHash = await hashearContrasena(password);
      await this.usuariosService.actualizarHashPassword(usuario.Id, nuevoHash);
    }

    return copiarUsuario(usuario);
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
      throw new Error('El correo ya está registrado');
    }
    if (await this.usuariosService.existeNombre(nombre)) {
      throw new Error('Ya existe una cuenta con ese nombre de usuario.');
    }

    return this.guardarPendienteYEnviar({
      nombre,
      correo,
      password,
      esCliente: false,
      tipoCliente: null,
      datosCliente: null,
    });
  }

  async solicitarRegistroCliente(
    body: Record<string, unknown>,
  ): Promise<{ EmailEnviado: boolean; MensajeError?: string }> {
    const correo = validarCorreoCliente(
      String(body.correo ?? body.Correo ?? ''),
    );
    const password = String(body.password ?? body.Password ?? '');
    const confirmPassword = String(
      body.confirmPassword ?? body.ConfirmPassword ?? password,
    );
    if (password !== confirmPassword) {
      throw new Error('Las contraseñas no coinciden.');
    }
    validarPasswordCliente(password);
    const { nombre, datos } = validarDatosCliente(body);

    if (await this.usuariosService.existeCorreo(correo)) {
      throw new Error('El correo ya está registrado');
    }

    return this.guardarPendienteYEnviar({
      nombre,
      correo,
      password,
      esCliente: true,
      tipoCliente: datos.tipo,
      datosCliente: datos as unknown as Record<string, unknown>,
    });
  }

  async completarCliente(
    usuarioId: number,
    body: Record<string, unknown>,
  ): Promise<Usuario> {
    const actual = await this.usuariosService.obtenerPorId(usuarioId);
    if (!actual) throw new Error('Usuario no encontrado.');
    if ((actual.Roles ?? []).some((r) => String(r).toLowerCase() === 'cliente')) {
      throw new Error('Esta cuenta ya tiene rol de cliente.');
    }

    const { datos } = validarDatosCliente(body);
    const actualizado = await this.usuariosService.aplicarPerfilCliente(
      usuarioId,
      datos,
    );
    if (!actualizado) throw new Error('No se pudo actualizar el perfil.');
    return actualizado;
  }

  private async guardarPendienteYEnviar(params: {
    nombre: string;
    correo: string;
    password: string;
    esCliente: boolean;
    tipoCliente: string | null;
    datosCliente: Record<string, unknown> | null;
  }): Promise<{ EmailEnviado: boolean; MensajeError?: string }> {
    const { nombre, correo, password, esCliente, tipoCliente, datosCliente } =
      params;
    const now = new Date();
    const nombreNormalizado = nombre.toLowerCase();

    const pendienteActivo = await this.registrosRepo
      .createQueryBuilder('r')
      .where(
        'r.Usado = false AND r.ExpiraEnUtc > :now AND LOWER(r.Correo) = :correo',
        { now, correo },
      )
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

    const token = generarCodigoNumerico();
    const passwordHash = await hashearContrasena(password);
    await this.registrosRepo.save(
      this.registrosRepo.create({
        Token: token,
        Correo: correo,
        Nombre: nombre,
        PasswordHash: passwordHash,
        ExpiraEnUtc: new Date(now.getTime() + TOKEN_LIFETIME_MS),
        Usado: false,
        EsRegistroCliente: esCliente,
        TipoCliente: tipoCliente,
        DatosCliente: datosCliente,
      }),
    );

    const frontBase = (
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('CORS_ORIGINS')?.split(',')[0] ||
      'http://localhost:5173'
    ).replace(/\/$/, '');
    const enlace = esCliente
      ? `${frontBase}/verificar-cuenta?correo=${encodeURIComponent(correo)}&token=${encodeURIComponent(token)}`
      : undefined;

    const emailEnviado = await this.emailService.enviarCodigoRegistro(
      correo,
      nombre,
      token,
      enlace,
    );
    if (!emailEnviado) {
      await this.registrosRepo
        .createQueryBuilder()
        .delete()
        .where('LOWER(Correo) = :correo AND Usado = false', { correo })
        .execute();
    }
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

    const esCliente = Boolean(entry.EsRegistroCliente);
    let nombreFinal = entry.Nombre.trim();
    if (await this.usuariosService.existeNombre(nombreFinal)) {
      if (!esCliente) {
        throw new Error('Ya existe una cuenta con ese nombre de usuario.');
      }
      const local = correo.split('@')[0] || 'cliente';
      const base = `${nombreFinal.slice(0, 150)} (${local})`.slice(0, 190);
      nombreFinal = base;
      let n = 2;
      while (await this.usuariosService.existeNombre(nombreFinal)) {
        nombreFinal = `${base} ${n}`.slice(0, 200);
        n += 1;
      }
    }

    if (!esCliente) {
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
    }

    const passwordHash = entry.PasswordHash.startsWith('$2')
      ? entry.PasswordHash
      : await hashearContrasena(entry.PasswordHash);

    const datos = (entry.DatosCliente || {}) as DatosClienteRegistro;

    const usuario = await this.usuariosService.crear({
      Nombre: nombreFinal,
      Correo: entry.Correo,
      PasswordHash: passwordHash,
      Roles: esCliente ? ['Cliente'] : ['Usuario'],
    });

    if (esCliente) {
      const tipo =
        String(entry.TipoCliente || datos.tipo || 'persona').toLowerCase() ===
        'empresa'
          ? 'empresa'
          : 'persona';
      await this.usuariosService.aplicarPerfilCliente(usuario.Id, {
        ...datos,
        tipo,
        telefono: datos.telefono || '',
        aceptoTerminos: true,
        aceptoPrivacidad: true,
      });
    }

    entry.Usado = true;
    await this.registrosRepo.save(entry);
    return (await this.usuariosService.obtenerPorId(usuario.Id)) || usuario;
  }

  async solicitarRecuperacion(request: {
    Identifier: string;
  }): Promise<{ Mensaje: string }> {
    const identifier = request.Identifier.trim();
    if (!identifier) {
      return { Mensaje: MENSAJE_RECUPERACION_GENERICO };
    }

    const usuario = await this.usuariosService.obtenerPorNombreOCorreo(identifier);
    if (!usuario || usuario.Estado.toLowerCase() !== 'activo') {
      return { Mensaje: MENSAJE_RECUPERACION_GENERICO };
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
      const mensajeEspera = mensajeEsperaCorreo(recuperacionActiva.ExpiraEnUtc);
      if (mensajeEspera) {
        return { Mensaje: mensajeEspera };
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

    const token = generarCodigoNumerico();
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
    if (!emailEnviado) {
      await this.passwordResetRepo
        .createQueryBuilder()
        .delete()
        .where('LOWER(Correo) = :correo AND Usado = false', {
          correo: usuario.Correo.toLowerCase(),
        })
        .execute();
      throw new Error(MENSAJE_CORREO_NO_ENVIADO);
    }
    return { Mensaje: MENSAJE_RECUPERACION_GENERICO };
  }

  async restablecerPassword(request: {
    Token: string;
    NuevaPassword: string;
    Identifier?: string;
  }): Promise<boolean> {
    const token = request.Token.trim().toUpperCase();
    const nuevaPassword = request.NuevaPassword;
    const identifier = (request.Identifier ?? '').trim();
    if (!token || !identifier) return false;

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

    const usuario = await this.usuariosService.obtenerPorNombreOCorreo(identifier);
    if (
      !usuario ||
      usuario.Correo.trim().toLowerCase() !== entry.Correo.trim().toLowerCase()
    ) {
      return false;
    }

    const actualizado = await this.usuariosService.actualizarPasswordPorCorreo(
      entry.Correo,
      nuevaPassword,
    );
    if (!actualizado) return false;

    await this.passwordResetRepo
      .createQueryBuilder()
      .update()
      .set({ Usado: true })
      .where('LOWER("Correo") = LOWER(:correo) AND "Usado" = false', {
        correo: entry.Correo,
      })
      .execute();
    return true;
  }
}
