/**
 * URL pública del sitio (enlaces en correos).
 * Por defecto la app en Netlify; no usar localhost en producción.
 */
export const FRONTEND_URL_PRODUCCION = 'https://cafeunaing.netlify.app';

export function baseUrlFrontend(config?: {
  get?: (clave: string) => string | undefined;
}): string {
  const desdeConfig =
    config?.get?.('FRONTEND_URL')?.trim() ||
    config?.get?.('CORS_ORIGINS')?.split(',')[0]?.trim() ||
    '';
  const crudo = desdeConfig || FRONTEND_URL_PRODUCCION;
  // Si alguien dejó localhost en el .env, igual usamos Netlify para los correos.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(crudo)) {
    return FRONTEND_URL_PRODUCCION;
  }
  return crudo.replace(/\/$/, '');
}
