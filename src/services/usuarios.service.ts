import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DatosClienteRegistro,
  TipoCliente,
  validarDatosClienteEdicion,
} from '../common/cliente-registro.util';
import { esRolCliente, esRolSuperAdmin } from '../common/roles.util';
import { tienePermiso } from '../common/permisos';
import { Usuario } from '../entities/usuario.entity';
import { hashearContrasena, verificarContrasena } from '../common/password.util';
import { UsuarioValidacion, copiarUsuario } from '../common/usuario-validacion';
import { ClientesService } from './clientes.service';

export interface UsuarioPerfilResponse {
  Id: number;
  Nombre: string;
  Correo: string;
  Estado: string;
  Roles: string[];
  FotoPerfilUrl: string | null;
  FotoBannerUrl: string | null;
  FotoPerfilPosicion: string | null;
  FotoBannerPosicion: string | null;
  TipoCliente: string | null;
  Telefono: string | null;
  Apellidos: string | null;
  Identificacion: string | null;
  NombreLegal: string | null;
  TipoDocumento: string | null;
  RazonSocial: string | null;
  NombreComercial: string | null;
  RepresentanteLegal: string | null;
  CedulaJuridica: string | null;
  DireccionFiscal: string | null;
  TelefonoOficina: string | null;
  FechaRegistroCliente: Date | null;
  FechaVerificacionCliente: Date | null;
}

@Injectable()
export class UsuariosService {
  private readonly estadoActivo = 'activo';
  private readonly estadoInactivo = 'inactivo';

  constructor(
    @InjectRepository(Usuario)
    private readonly repo: Repository<Usuario>,
    private readonly clientesService: ClientesService,
  ) {}

  async obtenerTodos(): Promise<Record<string, unknown>[]> {
    const usuarios = await this.repo.find({ order: { Id: 'ASC' } });
    const fichas = await this.clientesService.mapFichasPorUsuarioIds(
      usuarios.map((u) => u.Id),
    );
    return usuarios.map((u) => {
      const base = copiarUsuario(u) as unknown as Record<string, unknown>;
      const ficha = fichas.get(u.Id) || this.clientesService.fichaVacia();
      return { ...base, ...ficha };
    });
  }

  async obtenerActivos(): Promise<Usuario[]> {
    const usuarios = await this.repo.find({ order: { Id: 'ASC' } });
    return usuarios
      .filter((u) => this.esActivo(u.Estado))
      .map((u) => copiarUsuario(u));
  }

  async obtenerPorId(id: number): Promise<Usuario | null> {
    const usuario = await this.repo.findOne({ where: { Id: id } });
    return usuario ? copiarUsuario(usuario) : null;
  }

  async obtenerPorIdConCliente(
    id: number,
  ): Promise<Record<string, unknown> | null> {
    const usuario = await this.obtenerPorId(id);
    if (!usuario) return null;
    const ficha =
      (await this.clientesService.obtenerFichaPorUsuarioId(id)) ||
      this.clientesService.fichaVacia();
    return { ...(usuario as unknown as Record<string, unknown>), ...ficha };
  }

  async obtenerPorCorreo(correo: string): Promise<Usuario | null> {
    const normalized = correo.trim().toLowerCase();
    const usuario = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.Correo) = :correo', { correo: normalized })
      .getOne();
    return usuario ? copiarUsuario(usuario) : null;
  }

  async obtenerPorNombreOCorreo(
    identifier: string,
    opciones?: { incluirPassword?: boolean },
  ): Promise<Usuario | null> {
    const normalized = identifier.trim().toLowerCase();
    const usuario = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.Correo) = :id OR LOWER(u.Nombre) = :id', { id: normalized })
      .getOne();
    return usuario
      ? copiarUsuario(usuario, { incluirPassword: opciones?.incluirPassword })
      : null;
  }

  async existeCorreo(correo: string): Promise<boolean> {
    return (await this.obtenerPorCorreo(correo)) !== null;
  }

  async existeNombre(nombre: string): Promise<boolean> {
    const normalized = nombre.trim().toLowerCase();
    const count = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.Nombre) = :nombre', { nombre: normalized })
      .getCount();
    return count > 0;
  }

  async crear(nuevoUsuario: Partial<Usuario>): Promise<Usuario> {
    const passwordRaw = nuevoUsuario.PasswordHash!;
    const passwordHash = passwordRaw.startsWith('$2')
      ? passwordRaw
      : await hashearContrasena(passwordRaw);

    const usuario = this.repo.create({
      Nombre: nuevoUsuario.Nombre!.trim(),
      Correo: nuevoUsuario.Correo!.trim().toLowerCase(),
      PasswordHash: passwordHash,
      Estado: this.estadoActivo,
      Roles:
        !nuevoUsuario.Roles || nuevoUsuario.Roles.length === 0
          ? ['Usuario']
          : [...nuevoUsuario.Roles],
    });
    const saved = await this.repo.save(usuario);
    return copiarUsuario(saved);
  }

  async actualizarHashPassword(id: number, hash: string): Promise<void> {
    await this.repo.update({ Id: id }, { PasswordHash: hash });
  }

  async actualizarConActor(
    id: number,
    cambios: Partial<Usuario> & {
      DatosCliente?: Record<string, unknown> | null;
    },
    actorId?: number | null,
    actorRoles?: string[] | null,
    passwordActual?: string | null,
  ): Promise<Usuario | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    const puedeEditarOtros = tienePermiso(actorRoles, 'editar_usuarios');
    const puedeAsignarRoles = tienePermiso(actorRoles, 'asignar_roles');
    const puedeInactivar = tienePermiso(actorRoles, 'inactivar_usuarios');
    const esMismoUsuario = actorId != null && actorId === id;
    if (!esMismoUsuario && !puedeEditarOtros) {
      throw new Error('No tiene permiso para editar a este usuario.');
    }

    const puedeCambiarPassword = esMismoUsuario;
    const correoSolicitado = cambios.Correo?.trim()
      ? cambios.Correo.trim().toLowerCase()
      : actual.Correo;

    if (correoSolicitado.toLowerCase() !== actual.Correo.toLowerCase()) {
      throw new Error(
        'Para cambiar el correo debe verificarlo primero desde el formulario.',
      );
    }

    if (cambios.Nombre?.trim()) {
      actual.Nombre = cambios.Nombre.trim();
      UsuarioValidacion.validarNombre(actual.Nombre);
    }
    actual.Correo = correoSolicitado;

    if (cambios.PasswordHash?.trim()) {
      if (!puedeCambiarPassword) {
        throw new Error('Solo puede cambiar su propia contraseña.');
      }
      await this.validarPasswordActualLocal(actual.PasswordHash, passwordActual);
      UsuarioValidacion.validarPassword(cambios.PasswordHash);
      actual.PasswordHash = await hashearContrasena(cambios.PasswordHash);
    }

    if (puedeInactivar && cambios.Estado?.trim()) {
      actual.Estado = cambios.Estado;
    }
    if (puedeAsignarRoles && cambios.Roles && cambios.Roles.length > 0) {
      const rolesAnteriores = (actual.Roles ?? []).map(String);
      const rolesNuevos = cambios.Roles.map(String);
      const teniaCliente = rolesAnteriores.some(esRolCliente);
      const tieneCliente = rolesNuevos.some(esRolCliente);
      const teniaSuperAdmin = rolesAnteriores.some(esRolSuperAdmin);
      const tieneSuperAdmin = rolesNuevos.some(esRolSuperAdmin);

      if (esMismoUsuario && teniaSuperAdmin && !tieneSuperAdmin) {
        throw new Error('No puede quitarse a sí mismo el rol SuperAdmin.');
      }

      if (tieneCliente && !teniaCliente) {
        const rawCliente = cambios.DatosCliente;
        if (!rawCliente || typeof rawCliente !== 'object') {
          throw new Error(
            'Para asignar el rol Cliente debe completar la información de cliente.',
          );
        }
        const tipoRaw = String(
          (rawCliente as Record<string, unknown>).tipo ??
            (rawCliente as Record<string, unknown>).Tipo ??
            '',
        )
          .trim()
          .toLowerCase();
        const tipo: TipoCliente =
          tipoRaw === 'empresa' || tipoRaw === 'juridica' || tipoRaw === 'jurídica'
            ? 'empresa'
            : tipoRaw === 'persona' || tipoRaw === 'natural'
              ? 'persona'
              : ('' as TipoCliente);
        if (tipo !== 'persona' && tipo !== 'empresa') {
          throw new Error(
            'Para asignar el rol Cliente debe indicar si es persona o empresa y completar los datos.',
          );
        }
        const datos = validarDatosClienteEdicion(
          tipo,
          rawCliente as Record<string, unknown>,
        );
        await this.clientesService.guardarDesdeDatos(id, datos);
      }

      if (teniaCliente && !tieneCliente) {
        await this.clientesService.eliminarPorUsuarioId(id);
      }

      actual.Roles = [...rolesNuevos];
    }

    const saved = await this.repo.save(actual);
    return (await this.obtenerPorIdConCliente(saved.Id)) as unknown as Usuario;
  }

  async obtenerPerfil(id: number): Promise<UsuarioPerfilResponse | null> {
    const usuario = await this.repo.findOne({ where: { Id: id } });
    if (!usuario) return null;
    return this.toPerfilResponse(usuario);
  }

  async actualizarPerfil(
    id: number,
    request: {
      Nombre?: string;
      FotoPerfilUrl?: string | null;
      FotoBannerUrl?: string | null;
      FotoPerfilPosicion?: string | null;
      FotoBannerPosicion?: string | null;
    },
  ): Promise<UsuarioPerfilResponse | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    const nombre = request.Nombre?.trim() ? request.Nombre.trim() : actual.Nombre;
    UsuarioValidacion.validarNombre(nombre);

    if (nombre.toLowerCase() !== actual.Nombre.toLowerCase()) {
      const duplicado = await this.repo
        .createQueryBuilder('u')
        .where('u.Id != :id AND LOWER(u.Nombre) = :nombre', {
          id,
          nombre: nombre.toLowerCase(),
        })
        .getCount();
      if (duplicado > 0) {
        throw new Error('Ya existe una cuenta con ese nombre de usuario.');
      }
    }

    actual.Nombre = nombre;
    actual.FotoPerfilUrl = request.FotoPerfilUrl?.trim() || null;
    actual.FotoBannerUrl = request.FotoBannerUrl?.trim() || null;
    actual.FotoPerfilPosicion = this.normalizarPosicionImagen(
      request.FotoPerfilPosicion,
    );
    actual.FotoBannerPosicion = this.normalizarPosicionImagen(
      request.FotoBannerPosicion,
    );

    const saved = await this.repo.save(actual);
    return this.toPerfilResponse(saved);
  }

  async cambiarPassword(
    id: number,
    passwordActual: string,
    passwordNueva: string,
  ): Promise<boolean> {
    UsuarioValidacion.validarPassword(passwordNueva);
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return false;

    await this.validarPasswordActualLocal(actual.PasswordHash, passwordActual);
    actual.PasswordHash = await hashearContrasena(passwordNueva);
    await this.repo.save(actual);
    return true;
  }

  async toggleEstado(
    id: number,
    forzarEstado?: string | null,
    actorId?: number | null,
    actorRoles?: string[] | null,
  ): Promise<Usuario | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    if (!tienePermiso(actorRoles, 'inactivar_usuarios')) {
      throw new Error('No tiene permiso para inactivar o activar usuarios.');
    }
    if (actorId != null && actorId === id) {
      throw new Error('No puedes cambiar tu propio estado.');
    }

    const estadoSolicitado = this.normalizarEstado(forzarEstado);
    const nuevoEstado =
      estadoSolicitado ??
      (this.esActivo(actual.Estado) ? this.estadoInactivo : this.estadoActivo);

    if (actual.Estado.toLowerCase() === nuevoEstado.toLowerCase()) {
      return copiarUsuario(actual);
    }

    actual.Estado = nuevoEstado;
    const saved = await this.repo.save(actual);
    return copiarUsuario(saved);
  }

  async actualizarPasswordPorCorreo(
    correo: string,
    nuevaPassword: string,
  ): Promise<Usuario | null> {
    const normalized = correo.trim().toLowerCase();
    const actual = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.Correo) = :correo', { correo: normalized })
      .getOne();
    if (!actual) return null;

    actual.PasswordHash = await hashearContrasena(nuevaPassword);
    const saved = await this.repo.save(actual);
    return copiarUsuario(saved);
  }

  async aplicarPerfilCliente(
    id: number,
    datos: DatosClienteRegistro,
    opciones?: { Nombre?: string },
  ): Promise<Usuario | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    if (opciones?.Nombre?.trim()) actual.Nombre = opciones.Nombre.trim();

    await this.clientesService.guardarDesdeDatos(id, datos);

    const roles = new Set((actual.Roles ?? []).map(String));
    roles.add('Cliente');
    actual.Roles = [...roles];

    const saved = await this.repo.save(actual);
    return copiarUsuario(saved);
  }

  async actualizarPerfilCliente(
    id: number,
    datos: DatosClienteRegistro,
  ): Promise<UsuarioPerfilResponse | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    const esCliente = (actual.Roles ?? []).some(
      (r) => String(r).toLowerCase() === 'cliente',
    );
    if (!esCliente) {
      throw new Error('Esta cuenta no tiene ficha de cliente para editar.');
    }

    await this.clientesService.actualizarDesdeDatos(id, datos);
    return this.toPerfilResponse(actual);
  }

  private async toPerfilResponse(
    usuario: Usuario,
  ): Promise<UsuarioPerfilResponse> {
    const ficha =
      (await this.clientesService.obtenerFichaPorUsuarioId(usuario.Id)) ||
      this.clientesService.fichaVacia();
    return {
      Id: usuario.Id,
      Nombre: usuario.Nombre,
      Correo: usuario.Correo,
      Estado: usuario.Estado,
      Roles: [...usuario.Roles],
      FotoPerfilUrl: usuario.FotoPerfilUrl,
      FotoBannerUrl: usuario.FotoBannerUrl,
      FotoPerfilPosicion: usuario.FotoPerfilPosicion,
      FotoBannerPosicion: usuario.FotoBannerPosicion,
      TipoCliente: ficha.TipoCliente,
      Telefono: ficha.Telefono,
      Apellidos: ficha.Apellidos,
      Identificacion: ficha.Identificacion,
      NombreLegal: ficha.NombreLegal,
      TipoDocumento: ficha.TipoDocumento,
      RazonSocial: ficha.RazonSocial,
      NombreComercial: ficha.NombreComercial,
      RepresentanteLegal: ficha.RepresentanteLegal,
      CedulaJuridica: ficha.CedulaJuridica,
      DireccionFiscal: ficha.DireccionFiscal,
      TelefonoOficina: ficha.TelefonoOficina,
      FechaRegistroCliente: ficha.FechaRegistroCliente,
      FechaVerificacionCliente: ficha.FechaVerificacionCliente,
    };
  }

  private normalizarPosicionImagen(posicion?: string | null): string | null {
    if (!posicion?.trim()) return null;
    const partes = posicion.trim().split(/\s+/);
    if (partes.length !== 2) return null;
    if (!partes[0].endsWith('%') || !partes[1].endsWith('%')) return null;
    const x = Number.parseFloat(partes[0].slice(0, -1));
    const y = Number.parseFloat(partes[1].slice(0, -1));
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    const cx = Math.min(100, Math.max(0, x));
    const cy = Math.min(100, Math.max(0, y));
    return `${Math.round(cx)}% ${Math.round(cy)}%`;
  }

  private async validarPasswordActualLocal(
    passwordGuardada: string,
    passwordActual?: string | null,
  ): Promise<void> {
    if (!passwordActual?.trim()) {
      throw new Error('Debe ingresar su contraseña actual.');
    }
    const coincide = await verificarContrasena(passwordActual, passwordGuardada);
    if (!coincide) {
      throw new Error('La contraseña anterior no es correcta.');
    }
  }

  private esActivo(estado?: string | null): boolean {
    return (estado ?? '').trim().toLowerCase() === this.estadoActivo;
  }

  private normalizarEstado(estado?: string | null): string | null {
    if (!estado?.trim()) return null;
    return estado.trim().toLowerCase() === this.estadoInactivo
      ? this.estadoInactivo
      : this.estadoActivo;
  }
}
