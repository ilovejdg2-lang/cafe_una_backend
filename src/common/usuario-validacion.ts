import { Usuario } from '../entities/usuario.entity';
import { verificarContrasena } from './password.util';

export const MAX_NOMBRE_LENGTH = 20;
export const MAX_PASSWORD_LENGTH = 64;
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

  static async validarPasswordActual(
    passwordGuardada: string,
    passwordActual?: string | null,
  ): Promise<void> {
    if (!passwordActual?.trim()) {
      throw new Error('Debe ingresar la contraseña de la cuenta.');
    }
    const coincide = await verificarContrasena(passwordActual, passwordGuardada);
    if (!coincide) {
      throw new Error('La contraseña no es correcta.');
    }
  }
}

export function copiarUsuario(usuario: Usuario): Usuario {
  return {
    ...usuario,
    Roles: [...usuario.Roles],
  };
}
