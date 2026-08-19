import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
import { UsuarioValidacion, copiarUsuario } from '../common/usuario-validacion';

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
}

@Injectable()
export class UsuariosService {
  private readonly estadoActivo = 'activo';
  private readonly estadoInactivo = 'inactivo';

  constructor(
    @InjectRepository(Usuario)
    private readonly repo: Repository<Usuario>,
  ) {}

  async obtenerTodos(): Promise<Usuario[]> {
    const usuarios = await this.repo.find({ order: { Id: 'ASC' } });
    return usuarios.map((u) => copiarUsuario(u));
  }

  async obtenerActivos(): Promise<Usuario[]> {
    const usuarios = await this.obtenerTodos();
    return usuarios.filter((u) => this.esActivo(u.Estado));
  }

  async obtenerPorId(id: number): Promise<Usuario | null> {
    const usuario = await this.repo.findOne({ where: { Id: id } });
    return usuario ? copiarUsuario(usuario) : null;
  }

  async obtenerPorCorreo(correo: string): Promise<Usuario | null> {
    const normalized = correo.trim().toLowerCase();
    const usuario = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.Correo) = :correo', { correo: normalized })
      .getOne();
    return usuario ? copiarUsuario(usuario) : null;
  }

  async obtenerPorNombreOCorreo(identifier: string): Promise<Usuario | null> {
    const normalized = identifier.trim().toLowerCase();
    const usuario = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.Correo) = :id OR LOWER(u.Nombre) = :id', { id: normalized })
      .getOne();
    return usuario ? copiarUsuario(usuario) : null;
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
    const usuario = this.repo.create({
      Nombre: nuevoUsuario.Nombre!.trim(),
      Correo: nuevoUsuario.Correo!.trim().toLowerCase(),
      PasswordHash: nuevoUsuario.PasswordHash!,
      Estado: this.estadoActivo,
      Roles:
        !nuevoUsuario.Roles || nuevoUsuario.Roles.length === 0
          ? ['Usuario']
          : [...nuevoUsuario.Roles],
    });
    const saved = await this.repo.save(usuario);
    return copiarUsuario(saved);
  }

  async actualizarConActor(
    id: number,
    cambios: Partial<Usuario>,
    actorId?: number | null,
    actorRoles?: string[] | null,
    passwordActual?: string | null,
  ): Promise<Usuario | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    const puedeCambiarPassword = actorId != null && actorId === id;
    const actorEsSuperAdmin = actorRoles?.some(
      (r) => r.trim().toLowerCase() === 'superadmin',
    );
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
      this.validarPasswordActualLocal(actual.PasswordHash, passwordActual);
      UsuarioValidacion.validarPassword(cambios.PasswordHash);
      actual.PasswordHash = cambios.PasswordHash;
    }

    if (actorEsSuperAdmin && cambios.Estado?.trim()) {
      actual.Estado = cambios.Estado;
    }
    if (actorEsSuperAdmin && cambios.Roles && cambios.Roles.length > 0) {
      actual.Roles = [...cambios.Roles];
    }

    const saved = await this.repo.save(actual);
    return copiarUsuario(saved);
  }

  async obtenerPerfil(id: number): Promise<UsuarioPerfilResponse | null> {
    const usuario = await this.repo.findOne({ where: { Id: id } });
    return usuario ? this.toPerfilResponse(usuario) : null;
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

    this.validarPasswordActualLocal(actual.PasswordHash, passwordActual);
    actual.PasswordHash = passwordNueva;
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

    const esSuperAdmin = actorRoles?.some(
      (r) => r.trim().toLowerCase() === 'superadmin',
    );
    if (!esSuperAdmin) {
      throw new Error('Solo un SuperAdmin puede inactivar o activar usuarios.');
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

    actual.PasswordHash = nuevaPassword;
    const saved = await this.repo.save(actual);
    return copiarUsuario(saved);
  }

  private toPerfilResponse(usuario: Usuario): UsuarioPerfilResponse {
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

  private validarPasswordActualLocal(
    passwordGuardada: string,
    passwordActual?: string | null,
  ): void {
    if (!passwordActual?.trim()) {
      throw new Error('Debe ingresar su contraseña actual.');
    }
    if (passwordGuardada !== passwordActual) {
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
