import { BadRequestException } from '@nestjs/common';

/** Rutas internas o https; bloquea open-redirect y esquemas peligrosos. */
export function normalizarRutaSegura(rutaRaw: string): string {
  const ruta = (rutaRaw ?? '').trim();
  if (!ruta) {
    throw new BadRequestException('La ruta del enlace es obligatoria.');
  }
  if (/[\u0000-\u001F\u007F]/.test(ruta) || ruta.includes('\\')) {
    throw new BadRequestException('La ruta del enlace contiene caracteres no permitidos.');
  }
  const lower = ruta.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    throw new BadRequestException(
      'La ruta del enlace no puede usar esquemas inseguros.',
    );
  }
  // Protocol-relative //evil.com
  if (ruta.startsWith('//')) {
    throw new BadRequestException(
      'Solo se permiten rutas internas (/...) o enlaces https.',
    );
  }
  if (ruta.startsWith('/')) return ruta;
  if (/^https:\/\//i.test(ruta)) return ruta;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(ruta)) {
    return ruta;
  }
  throw new BadRequestException(
    'Solo se permiten rutas internas (/...) o enlaces https.',
  );
}

/** URL de imagen/perfil: solo https (o vacío). */
export function normalizarUrlHttpsOVacia(urlRaw: string | null | undefined): string | null {
  const url = (urlRaw ?? '').trim();
  if (!url) return null;
  const lower = url.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    url.startsWith('//')
  ) {
    throw new BadRequestException('La URL debe usar https.');
  }
  if (/^https:\/\//i.test(url)) return url;
  throw new BadRequestException('Solo se permiten URLs https.');
}
