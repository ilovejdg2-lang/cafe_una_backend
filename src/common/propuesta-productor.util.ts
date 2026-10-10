import { validarCorreoCliente, validarTelefono } from './cliente-registro.util';

/**
 * Límite de la descripción del emprendimiento.
 * Se aplica igual en el formulario, en la API y en la columna Descripcion (varchar 2000).
 */
export const DESCRIPCION_MAX = 2000;
export const NOMBRE_MAX = 100;
export const DIRECCION_MAX = 500;
export const DIVISION_MAX = 80;
export const URL_MAX = 500;
export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 1000;
export const IMAGEN_MAX_BYTES = 5 * 1024 * 1024;
export const TERMINOS_VERSION = 'propuesta-productor-v1';
export const TERMINOS_TEXTO =
  'Autorizo la publicación de la información de mi emprendimiento en el sitio web de Café UNA si mi propuesta es aprobada. Entiendo que cualquier cambio posterior deberá solicitarse por correo al administrador';

export const ESTADOS_PROPUESTA = ['Pendiente', 'Aprobada', 'Rechazada'] as const;
export type EstadoPropuesta = (typeof ESTADOS_PROPUESTA)[number];

const HOSTS_FACEBOOK = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'fb.com',
  'www.fb.com',
  'm.fb.com',
  'fb.me',
  'www.fb.me',
]);

const HOSTS_INSTAGRAM = new Set([
  'instagram.com',
  'www.instagram.com',
]);

export type ImagenDetectada = {
  extension: '.jpg' | '.png' | '.webp';
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
};

export type PropuestaNormalizada = {
  nombre: string;
  provincia: string;
  canton: string;
  distrito: string;
  direccion: string;
  enlaceUbicacion: string;
  descripcion: string;
  facebook: string | null;
  instagram: string | null;
  whatsapp: string | null;
  sitioWeb: string | null;
  correo: string;
  telefono: string;
  aceptaTerminos: true;
};

export function textoPlano(valor: unknown, max: number): string {
  return String(valor ?? '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);
}

function exigirTexto(valor: unknown, etiqueta: string, max: number): string {
  const limpio = textoPlano(valor, max + 1);
  if (!limpio) {
    throw new Error(`${etiqueta} es obligatorio.`);
  }
  if (limpio.length > max) {
    throw new Error(`${etiqueta} admite como máximo ${max} caracteres.`);
  }
  return limpio;
}

function urlSegura(valor: string): URL {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('El enlace no es válido.');
  }
  if (url.username || url.password) {
    throw new Error('El enlace no es válido.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('El enlace debe usar HTTP o HTTPS.');
  }
  return url;
}

export function validarEnlaceUbicacion(valor: unknown): string {
  const raw = String(valor ?? '').trim();
  if (!raw) throw new Error('El enlace de ubicación es obligatorio.');
  if (raw.length > URL_MAX) {
    throw new Error(`El enlace de ubicación admite como máximo ${URL_MAX} caracteres.`);
  }
  const url = urlSegura(raw);
  if (url.protocol !== 'https:') {
    throw new Error('El enlace de ubicación debe usar HTTPS.');
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname || '/';
  const googleMaps =
    (host === 'google.com' || host === 'www.google.com') &&
    (path === '/maps' || path.startsWith('/maps/'));
  const gooGl =
    host === 'goo.gl' && (path === '/maps' || path.startsWith('/maps/'));
  const permitido =
    host === 'maps.google.com' ||
    host === 'maps.app.goo.gl' ||
    host === 'waze.com' ||
    host === 'www.waze.com' ||
    googleMaps ||
    gooGl;
  if (!permitido) {
    throw new Error('El enlace debe ser de Google Maps o Waze.');
  }
  return url.toString();
}

function validarRedSocial(
  valor: unknown,
  etiqueta: string,
  hosts: Set<string>,
): string | null {
  const raw = String(valor ?? '').trim();
  if (!raw) return null;
  if (raw.length > URL_MAX) {
    throw new Error(`${etiqueta} admite como máximo ${URL_MAX} caracteres.`);
  }
  const url = urlSegura(raw);
  if (url.protocol !== 'https:') {
    throw new Error(`${etiqueta} debe usar HTTPS.`);
  }
  if (!hosts.has(url.hostname.toLowerCase())) {
    throw new Error(`${etiqueta} no corresponde a un enlace válido.`);
  }
  return url.toString();
}

export function validarSitioWeb(valor: unknown): string | null {
  const raw = String(valor ?? '').trim();
  if (!raw) return null;
  if (raw.length > URL_MAX) {
    throw new Error(`El sitio web admite como máximo ${URL_MAX} caracteres.`);
  }
  const url = urlSegura(raw);
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host.endsWith('.')) {
    throw new Error('El sitio web no es un enlace válido.');
  }
  return url.toString();
}

export function normalizarTelefonoContacto(valor: unknown): string {
  const validado = validarTelefono(String(valor ?? ''));
  let digitos = validado.replace(/\D/g, '');
  const explicito = validado.startsWith('+') || validado.startsWith('00');
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  if (explicito) {
    if (digitos.length < 8 || digitos.length > 15) {
      throw new Error('El teléfono no tiene un formato válido.');
    }
    return `+${digitos}`;
  }
  if (digitos.length === 8) return `+506${digitos}`;
  if (digitos.length === 11 && digitos.startsWith('506')) return `+${digitos}`;
  if (digitos.length >= 10 && digitos.length <= 15) return `+${digitos}`;
  throw new Error('El teléfono no tiene un formato válido.');
}

export function normalizarWhatsapp(valor: unknown): string | null {
  const raw = String(valor ?? '').trim();
  if (!raw) return null;
  let digitos = raw.replace(/\D/g, '');
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  const tieneCodigo =
    raw.startsWith('+') || raw.startsWith('00') || digitos.length >= 10;
  if (!tieneCodigo || digitos.length < 10 || digitos.length > 15) {
    throw new Error(
      'El WhatsApp debe incluir el código de país, por ejemplo +506 8888 8888.',
    );
  }
  return `https://wa.me/${digitos}`;
}

export function validarDescripcion(valor: unknown): string {
  const texto = String(valor ?? '')
    .replace(/\u0000/g, '')
    .trim();
  if (!texto) throw new Error('La descripción es obligatoria.');
  if (texto.length > DESCRIPCION_MAX) {
    throw new Error(
      `La descripción admite como máximo ${DESCRIPCION_MAX} caracteres.`,
    );
  }
  return texto;
}

export function validarMotivoRechazo(valor: unknown): string {
  const texto = String(valor ?? '')
    .replace(/\u0000/g, '')
    .trim();
  if (texto.length < MOTIVO_MIN) {
    throw new Error(
      `El motivo del rechazo debe tener al menos ${MOTIVO_MIN} caracteres.`,
    );
  }
  if (texto.length > MOTIVO_MAX) {
    throw new Error(
      `El motivo del rechazo admite como máximo ${MOTIVO_MAX} caracteres.`,
    );
  }
  return texto;
}

export function validarClaveIdempotencia(valor: unknown): string {
  const clave = String(valor ?? '').trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(clave)) {
    throw new Error('La clave de envío no es válida. Recargá la página e intentá de nuevo.');
  }
  return clave;
}

export function aceptaTerminos(valor: unknown): true {
  const raw = String(valor ?? '').trim().toLowerCase();
  if (valor === true || raw === 'true' || raw === '1' || raw === 'on' || raw === 'si') {
    return true;
  }
  throw new Error('Debés aceptar la autorización de publicación para enviar la propuesta.');
}

export function validarPropuestaEntrada(
  body: Record<string, unknown>,
): PropuestaNormalizada {
  return {
    nombre: exigirTexto(
      body.nombre ?? body.Nombre ?? body.nombreEmprendimiento,
      'El nombre del emprendimiento',
      NOMBRE_MAX,
    ),
    provincia: exigirTexto(
      body.provincia ?? body.Provincia,
      'La provincia',
      DIVISION_MAX,
    ),
    canton: exigirTexto(body.canton ?? body.Canton, 'El cantón', DIVISION_MAX),
    distrito: exigirTexto(
      body.distrito ?? body.Distrito,
      'El distrito',
      DIVISION_MAX,
    ),
    direccion: exigirTexto(
      body.direccion ?? body.Direccion ?? body.ubicacion,
      'La dirección o señas adicionales',
      DIRECCION_MAX,
    ),
    enlaceUbicacion: validarEnlaceUbicacion(
      body.enlaceUbicacion ?? body.EnlaceUbicacion ?? body.mapsUrl,
    ),
    descripcion: validarDescripcion(body.descripcion ?? body.Descripcion),
    facebook: validarRedSocial(
      body.facebook ?? body.Facebook,
      'Facebook',
      HOSTS_FACEBOOK,
    ),
    instagram: validarRedSocial(
      body.instagram ?? body.Instagram,
      'Instagram',
      HOSTS_INSTAGRAM,
    ),
    whatsapp: normalizarWhatsapp(body.whatsapp ?? body.Whatsapp),
    sitioWeb: validarSitioWeb(body.sitioWeb ?? body.SitioWeb),
    correo: validarCorreoCliente(
      String(body.correo ?? body.Correo ?? body.correoContacto ?? ''),
    ),
    telefono: normalizarTelefonoContacto(
      body.telefono ?? body.Telefono ?? body.telefonoContacto,
    ),
    aceptaTerminos: aceptaTerminos(
      body.aceptaTerminos ?? body.AceptaTerminos ?? body.terminos,
    ),
  };
}

export function detectarImagenReal(buffer: Buffer): ImagenDetectada {
  if (!buffer || buffer.length < 12) {
    throw new Error('La imagen no tiene un formato permitido.');
  }
  if (buffer.length > IMAGEN_MAX_BYTES) {
    throw new Error('La imagen no puede superar 5 MB.');
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: '.jpg', mime: 'image/jpeg' };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { extension: '.png', mime: 'image/png' };
  }
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { extension: '.webp', mime: 'image/webp' };
  }
  throw new Error('La imagen debe ser JPG, JPEG, PNG o WebP.');
}

export function escapeHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function assertTransicionDesdePendiente(estado: string): void {
  if (estado !== 'Pendiente') {
    throw new Error(
      'Esta propuesta ya fue revisada. Actualizá la página para ver el resultado.',
    );
  }
}
