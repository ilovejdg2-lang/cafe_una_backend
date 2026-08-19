export const MAX_NOMBRE_LENGTH = 20;
export const MAX_PASSWORD_LENGTH = 15;
export const MIN_PASSWORD_LENGTH = 6;

export class UsuarioValidacion {
  static validarNombre(nombre: string): void {
    if (!nombre?.trim()) {
      throw new Error('El nombre es obligatorio.');
    }
    if (nombre.trim().length > MAX_NOMBRE_LENGTH) {
      throw new Error(
        `El nombre de usuario no puede tener más de ${MAX_NOMBRE_LENGTH} caracteres.`,
      );
    }
  }

  static validarPassword(password?: string | null, requerida = true): void {
    if (!password) {
      if (requerida) {
        throw new Error('La contraseña es obligatoria.');
      }
      return;
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new Error(
        `La contraseña no puede tener más de ${MAX_PASSWORD_LENGTH} caracteres.`,
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
    }
  }

  static validarPasswordActual(
    passwordGuardada: string,
    passwordActual?: string | null,
  ): void {
    if (!passwordActual?.trim()) {
      throw new Error('Debe ingresar la contraseña de la cuenta.');
    }
    if (passwordGuardada !== passwordActual) {
      throw new Error('La contraseña no es correcta.');
    }
  }
}

export function esSuperAdmin(roles?: string[] | null): boolean {
  return (
    roles?.some(
      (r) => (r ?? '').trim().toLowerCase() === 'superadmin',
    ) ?? false
  );
}

import { Usuario } from '../entities/usuario.entity';

export function copiarUsuario(usuario: Usuario): Usuario {
  return {
    ...usuario,
    Roles: [...usuario.Roles],
  };
}
