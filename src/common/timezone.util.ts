/**
 * Utilidades para manejo consistente de zona horaria y fechas del sistema.
 * La zona horaria predeterminada de Café UNA es 'America/Costa_Rica'.
 */

export const ZONA_HORARIA_DEFAULT = 'America/Costa_Rica';

/**
 * Obtiene el identificador IANA de la zona horaria configurada.
 */
export function obtenerZonaHoraria(): string {
  const envTz = process.env.APP_TIMEZONE || process.env.TIMEZONE;
  if (envTz && typeof envTz === 'string' && envTz.trim()) {
    return envTz.trim();
  }
  return ZONA_HORARIA_DEFAULT;
}

/**
 * Retorna la fecha actual en formato ISO 'YYYY-MM-DD' según la zona horaria configurada.
 * Si se pasa una zona horaria inválida, retrocede de forma segura a 'America/Costa_Rica'.
 */
export function hoyIsoEnZona(timeZone: string = obtenerZonaHoraria()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_HORARIA_DEFAULT,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  }
}

/**
 * Retorna fecha y hora formateada en la zona horaria para registros y auditoría.
 */
export function fechaHoraIsoEnZona(timeZone: string = obtenerZonaHoraria()): string {
  try {
    const formatter = new Intl.DateTimeFormat('es-CR', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toLocaleString('es-CR');
  }
}
