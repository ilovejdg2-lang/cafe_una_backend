import { BadRequestException } from '@nestjs/common';

const MAX_DIRECCION = 300;
const MAX_URL = 500;
const PREFIJOS_IMAGEN_PROPIA = [
  '/api/inventario/ubicaciones/imagenes/',
  '/api/productos/imagenes/',
  '/api/informacion/imagenes/',
];

export type PresentacionPuntoVenta = {
  imagenUrl: string | null;
  direccion: string | null;
  mapsUrl: string | null;
};

const MAX_IMAGENES = 3;
const MAX_TELEFONO = 40;
const MAX_HORARIO = 300;

export function normalizarTelefonoPunto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException('El teléfono no es válido.');
  }
  const texto = value.trim();
  if (!texto) return null;
  if (texto.length > MAX_TELEFONO || !/^[0-9+\s().-]+$/.test(texto) || texto.replace(/\D/g, '').length < 6) {
    throw new BadRequestException('El teléfono debe tener entre 6 y 40 caracteres válidos.');
  }
  return texto;
}

export function normalizarHorarioPunto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException('El horario no es válido.');
  }
  const texto = value.trim();
  if (!texto) return null;
  if (texto.length > MAX_HORARIO) {
    throw new BadRequestException('El horario debe tener como máximo 300 caracteres.');
  }
  return texto;
}

export function normalizarImagenesPunto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const lista = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : null;
  if (!lista) {
    throw new BadRequestException('Las imágenes del punto de venta no son válidas.');
  }
  const urls = lista.map((item) => normalizarImagenPunto(item)).filter((item): item is string => Boolean(item));
  if (urls.length > MAX_IMAGENES) {
    throw new BadRequestException('Podés agregar hasta 3 imágenes adicionales.');
  }
  return urls.length ? urls.join('\n') : null;
}

export function listarImagenesPunto(value: string | null | undefined): string[] {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizarDireccionPunto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException('La dirección no es válida.');
  }
  const texto = value.trim();
  if (!texto) return null;
  if (texto.length > MAX_DIRECCION) {
    throw new BadRequestException(
      'La dirección debe tener como máximo 300 caracteres.',
    );
  }
  return texto;
}

export function normalizarImagenPunto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException('La imagen del punto de venta no es válida.');
  }
  const texto = value.trim();
  if (!texto) return null;
  if (texto.length > MAX_URL) {
    throw new BadRequestException('La URL de la imagen es demasiado larga.');
  }

  const propia = PREFIJOS_IMAGEN_PROPIA.find((prefijo) => texto.startsWith(prefijo));
  if (propia) {
    const nombre = texto.slice(propia.length);
    if (!nombre || nombre.includes('/') || !/^[A-Za-z0-9._-]+$/.test(nombre)) {
      throw new BadRequestException('La imagen del punto de venta no es válida.');
    }
    return texto;
  }

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    throw new BadRequestException('La imagen del punto de venta no es válida.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BadRequestException('La imagen debe ser una URL http o https.');
  }
  return url.toString();
}

export function esUrlGoogleMaps(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.replace(/\.$/, '').toLowerCase();
  const path = url.pathname.toLowerCase();
  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl' && (path === '/maps' || path.startsWith('/maps/'))) return true;
  if (/^maps\.google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) return true;
  if (
    /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host) &&
    (path === '/maps' || path.startsWith('/maps/'))
  ) {
    return true;
  }
  return false;
}

export function normalizarMapsUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException('La URL de Google Maps no es válida.');
  }
  const texto = value.trim();
  if (!texto) return null;
  if (texto.length > MAX_URL) {
    throw new BadRequestException('La URL de Google Maps es demasiado larga.');
  }
  if (!esUrlGoogleMaps(texto)) {
    throw new BadRequestException('El enlace debe ser una URL válida de Google Maps.');
  }
  return new URL(texto).toString();
}
