import { randomUUID } from 'crypto';

export const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
export const EMAIL_COOLDOWN_MS = 3 * 60 * 1000;
export const EMAIL_COOLDOWN_MINUTES = 3;
export const MENSAJE_ESPERA_CORREO =
  'No se puede mandar un correo seguido. Espera 3 minutos.';

export function generarCodigoNumerico(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generarCodigoRecuperacion(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function expiraEn(minutos = 30): Date {
  return new Date(Date.now() + minutos * 60 * 1000);
}

export function mensajeEsperaCorreo(expiraEnUtc: Date): string | null {
  const enviadoEn = new Date(expiraEnUtc.getTime() - TOKEN_LIFETIME_MS);
  const transcurrido = Date.now() - enviadoEn.getTime();
  if (transcurrido >= EMAIL_COOLDOWN_MS) return null;
  return MENSAJE_ESPERA_CORREO;
}

export function mensajeEsperaCorreoPorMinutos(expiraEnUtc: Date): string | null {
  const segundosRestantes = Math.ceil((expiraEnUtc.getTime() - Date.now()) / 1000);
  if (segundosRestantes <= 0) return null;
  const minutosRestantes = Math.ceil(segundosRestantes / 60);
  if (minutosRestantes >= EMAIL_COOLDOWN_MINUTES) return null;
  return `${MENSAJE_ESPERA_CORREO} Faltan ${minutosRestantes} min.`;
}
