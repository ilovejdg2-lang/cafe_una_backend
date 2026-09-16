import { randomBytes, randomInt } from 'crypto';

/** Vigencia del código enviado por correo. */
export const TOKEN_LIFETIME_MINUTES = 30;
export const TOKEN_LIFETIME_MS = TOKEN_LIFETIME_MINUTES * 60 * 1000;

/** Códigos numéricos de verificación (registro, recuperación, cambio de correo). */
export const CODIGO_DIGITOS = 5;

export const EMAIL_COOLDOWN_MS = 3 * 60 * 1000;
export const EMAIL_COOLDOWN_MINUTES = 3;
export const MENSAJE_ESPERA_CORREO =
  'No se puede mandar un correo seguido. Espera 3 minutos.';

export function toDateUtc(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Código de exactamente 5 dígitos (10000–99999). */
export function generarCodigoNumerico(): string {
  const min = 10 ** (CODIGO_DIGITOS - 1);
  const max = 10 ** CODIGO_DIGITOS;
  return String(randomInt(min, max));
}

/** Normaliza lo que pegó la persona (espacios, guiones) a solo dígitos. */
export function normalizarCodigoVerificacion(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\D/g, '')
    .slice(0, CODIGO_DIGITOS);
}

export function codigoVerificacionValido(codigo: string): boolean {
  return new RegExp(`^\\d{${CODIGO_DIGITOS}}$`).test(codigo);
}

export function expiraEnUtcDesdeAhora(
  minutos = TOKEN_LIFETIME_MINUTES,
): Date {
  return new Date(Date.now() + minutos * 60 * 1000);
}

/** @deprecated Preferí expiraEnUtcDesdeAhora; se mantiene por compatibilidad. */
export function expiraEn(minutos = TOKEN_LIFETIME_MINUTES): Date {
  return expiraEnUtcDesdeAhora(minutos);
}

/** 20 hex chars (80 bits) — cabe en columnas Token varchar(20). */
export function generarCodigoRecuperacion(): string {
  return randomBytes(10).toString('hex').toUpperCase();
}

/**
 * Bloquea reenvío durante EMAIL_COOLDOWN_MS desde que se envió el código.
 * Usa ExpiraEnUtc − TOKEN_LIFETIME_MS como marca de envío.
 */
export function mensajeEsperaCorreo(
  expiraEnUtc: Date | string | null | undefined,
): string | null {
  const expira = toDateUtc(expiraEnUtc);
  if (!expira) return null;

  const enviadoEn = new Date(expira.getTime() - TOKEN_LIFETIME_MS);
  const transcurrido = Date.now() - enviadoEn.getTime();
  if (transcurrido >= EMAIL_COOLDOWN_MS) return null;

  const segundosRestantes = Math.ceil(
    (EMAIL_COOLDOWN_MS - transcurrido) / 1000,
  );
  const minutosRestantes = Math.max(1, Math.ceil(segundosRestantes / 60));
  return `${MENSAJE_ESPERA_CORREO} Faltan ${minutosRestantes} min.`;
}

/** Alias: misma lógica correcta de cooldown (antes estaba invertida). */
export function mensajeEsperaCorreoPorMinutos(
  expiraEnUtc: Date | string | null | undefined,
): string | null {
  return mensajeEsperaCorreo(expiraEnUtc);
}
