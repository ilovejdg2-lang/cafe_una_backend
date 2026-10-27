/** Límites aproximados de Costa Rica para validar el pin confirmado. */
export const CR_LAT_MIN = 7.9;
export const CR_LAT_MAX = 11.35;
export const CR_LNG_MIN = -86.1;
/** Tope este un poco más cerrado para no aceptar pines en Chiriquí/Panamá. */
export const CR_LNG_MAX = -82.55;

export type Coordenadas = { latitud: number; longitud: number };

/** Dominios permitidos al seguir redirecciones de Maps/Waze. */
export function hostMapasPermitido(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase();
  if (
    host === 'maps.google.com' ||
    host === 'www.maps.google.com' ||
    host === 'maps.google.co.cr' ||
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl' ||
    host === 'www.goo.gl' ||
    host === 'waze.com' ||
    host === 'www.waze.com' ||
    host === 'ul.waze.com'
  ) {
    return true;
  }
  if (
    host === 'google.com' ||
    host === 'www.google.com' ||
    host === 'google.co.cr' ||
    host === 'www.google.co.cr'
  ) {
    return true;
  }
  return false;
}

function hostPermitido(hostname: string): boolean {
  return hostMapasPermitido(hostname);
}

export function esUrlMapasOWaze(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  const path = url.pathname || '/';
  if (
    host === 'maps.google.com' ||
    host === 'www.maps.google.com' ||
    host === 'maps.google.co.cr' ||
    host === 'maps.app.goo.gl'
  ) {
    return true;
  }
  if (
    (host === 'goo.gl' || host === 'www.goo.gl') &&
    (path === '/maps' || path.startsWith('/maps/'))
  ) {
    return true;
  }
  if (
    (host === 'google.com' ||
      host === 'www.google.com' ||
      host === 'google.co.cr' ||
      host === 'www.google.co.cr') &&
    (path === '/maps' || path.startsWith('/maps/'))
  ) {
    return true;
  }
  if (host === 'waze.com' || host === 'www.waze.com' || host === 'ul.waze.com') {
    return true;
  }
  return false;
}

function esParValido(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function estaEnCostaRica(lat: number, lng: number): boolean {
  return (
    esParValido(lat, lng) &&
    lat >= CR_LAT_MIN &&
    lat <= CR_LAT_MAX &&
    lng >= CR_LNG_MIN &&
    lng <= CR_LNG_MAX
  );
}

export const MENSAJE_SOLO_COSTA_RICA =
  'La ubicación tiene que estar en Costa Rica. El mapa público solo cubre el país; pegá un enlace del lugar en CR o marcá el punto en el mapa.';

/** Devuelve las coords solo si están en Costa Rica; si hay pin fuera, lanza error. */
export function exigirCoordenadasEnCostaRica(
  coords: Coordenadas | null,
): Coordenadas | null {
  if (!coords) return null;
  if (!estaEnCostaRica(coords.latitud, coords.longitud)) {
    throw new Error(MENSAJE_SOLO_COSTA_RICA);
  }
  return coords;
}

function textoDecodificado(url: URL): string {
  const crudo = `${url.pathname}${url.search}${url.hash}`;
  try {
    return decodeURIComponent(crudo);
  } catch {
    return crudo;
  }
}

/**
 * Extrae coordenadas confiables de un enlace de Maps/Waze.
 * Prioriza el pin del lugar (!3d!4d, destino de ruta !1d!2d, q=lat,lng, ll=).
 * No usa solo el centro de cámara (@lat,lng) porque puede no ser el lugar.
 */
export function extraerCoordenadasDeEnlace(enlace: string): Coordenadas | null {
  const raw = String(enlace || '').trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!hostPermitido(url.hostname)) return null;

  const texto = textoDecodificado(url);

  const lugar3d4d = texto.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (lugar3d4d) {
    const lat = Number(lugar3d4d[1]);
    const lng = Number(lugar3d4d[2]);
    if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
  }

  // Destino de una ruta /maps/dir/... : Google usa !2m2!1dLNG!2dLAT.
  const destinoRuta = texto.match(
    /!2m2!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/i,
  );
  if (destinoRuta) {
    const lng = Number(destinoRuta[1]);
    const lat = Number(destinoRuta[2]);
    if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
  }

  const dataParam = url.searchParams.get('data') || '';
  let dataTexto = dataParam;
  try {
    dataTexto = decodeURIComponent(dataParam);
  } catch {
    dataTexto = dataParam;
  }
  const dataMatch = dataTexto.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (dataMatch) {
    const lat = Number(dataMatch[1]);
    const lng = Number(dataMatch[2]);
    if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
  }
  const dataDestino = dataTexto.match(
    /!2m2!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/i,
  );
  if (dataDestino) {
    const lng = Number(dataDestino[1]);
    const lat = Number(dataDestino[2]);
    if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
  }

  for (const clave of ['ll', 'sll']) {
    const valor = url.searchParams.get(clave);
    if (!valor) continue;
    const partes = valor.split(',');
    if (partes.length >= 2) {
      const lat = Number(partes[0]);
      const lng = Number(partes[1]);
      if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
    }
  }

  const q = url.searchParams.get('q') || url.searchParams.get('query') || '';
  const qMatch = q.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (qMatch) {
    const lat = Number(qMatch[1]);
    const lng = Number(qMatch[2]);
    if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
  }

  const pathSearch = url.pathname.match(
    /\/maps\/(?:search|place)\/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i,
  );
  if (pathSearch) {
    const lat = Number(pathSearch[1]);
    const lng = Number(pathSearch[2]);
    if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
  }

  return null;
}

/** Busca pines en el HTML de Google Maps cuando la URL final no los trae. */
export function extraerCoordenadasDeHtml(html: string): Coordenadas | null {
  const texto = String(html || '');
  if (!texto) return null;

  const encoded = texto.match(/%213d(-?\d+\.\d+)%214d(-?\d+\.\d+)/i);
  if (encoded) {
    const lat = Number(encoded[1]);
    const lng = Number(encoded[2]);
    if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
  }

  const lugar = texto.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/i);
  if (lugar) {
    const lat = Number(lugar[1]);
    const lng = Number(lugar[2]);
    if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
  }

  const destino = texto.match(/!2m2!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/i);
  if (destino) {
    const lng = Number(destino[1]);
    const lat = Number(destino[2]);
    if (esParValido(lat, lng)) return { latitud: lat, longitud: lng };
  }

  return null;
}

export function validarCoordenadasEntrada(
  latitudRaw: unknown,
  longitudRaw: unknown,
  { exigir = false }: { exigir?: boolean } = {},
): Coordenadas | null {
  const latTexto = String(latitudRaw ?? '').trim();
  const lngTexto = String(longitudRaw ?? '').trim();
  if (!latTexto && !lngTexto) {
    if (exigir) throw new Error('Confirmá la ubicación en el mapa.');
    return null;
  }
  if (!latTexto || !lngTexto) {
    throw new Error('La latitud y la longitud deben enviarse juntas.');
  }
  const latitud = Number(latTexto);
  const longitud = Number(lngTexto);
  if (!esParValido(latitud, longitud)) {
    throw new Error('Las coordenadas no son válidas.');
  }
  if (!estaEnCostaRica(latitud, longitud)) {
    throw new Error(MENSAJE_SOLO_COSTA_RICA);
  }
  return { latitud, longitud };
}

export function resolverCoordenadasPropuesta(input: {
  enlaceUbicacion: string;
  latitud?: unknown;
  longitud?: unknown;
  enlaceAnterior?: string | null;
  latitudAnterior?: number | null;
  longitudAnterior?: number | null;
}): Coordenadas | null {
  const manual = validarCoordenadasEntrada(input.latitud, input.longitud);
  if (manual) return manual;

  const enlace = String(input.enlaceUbicacion || '').trim();
  const enlaceAnterior = String(input.enlaceAnterior || '').trim();
  const mismoEnlace = Boolean(enlaceAnterior) && enlace === enlaceAnterior;
  if (
    mismoEnlace &&
    Number.isFinite(Number(input.latitudAnterior)) &&
    Number.isFinite(Number(input.longitudAnterior))
  ) {
    const prev = validarCoordenadasEntrada(
      input.latitudAnterior,
      input.longitudAnterior,
    );
    if (prev) return prev;
  }

  return extraerCoordenadasDeEnlace(enlace);
}

/** Sigue redirecciones solo hacia dominios de Maps/Waze. */
export async function resolverEnlaceMapas(
  enlace: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ enlaceFinal: string; coordenadas: Coordenadas | null }> {
  let actual = String(enlace || '').trim();
  if (!actual) throw new Error('El enlace de ubicación es obligatorio.');

  let url: URL;
  try {
    url = new URL(actual);
  } catch {
    throw new Error('El enlace de ubicación no es válido.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('El enlace de ubicación debe usar HTTPS.');
  }
  if (!esUrlMapasOWaze(url)) {
    throw new Error(
      'Solo se permiten enlaces de Google Maps o Waze. Abrí el lugar, tocá Compartir y copiá ese enlace.',
    );
  }

  for (let i = 0; i < 5; i += 1) {
    const desdeEnlace = extraerCoordenadasDeEnlace(actual);
    if (desdeEnlace) {
      return { enlaceFinal: actual, coordenadas: desdeEnlace };
    }

    const respuesta = await fetchImpl(actual, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CafeUNA-Ubicacion/1.0; +https://cafeuna.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const location = respuesta.headers.get('location');
    if (
      location &&
      (respuesta.status === 301 ||
        respuesta.status === 302 ||
        respuesta.status === 303 ||
        respuesta.status === 307 ||
        respuesta.status === 308)
    ) {
      const siguiente = new URL(location, actual);
      if (siguiente.protocol !== 'https:' || !hostPermitido(siguiente.hostname)) {
        throw new Error('La redirección del enlace no es segura.');
      }
      actual = siguiente.toString();
      continue;
    }

    const finalUrl = String(respuesta.url || actual);
    let coords = extraerCoordenadasDeEnlace(finalUrl);
    if (!coords) {
      try {
        const html = await respuesta.text();
        coords = extraerCoordenadasDeHtml(html.slice(0, 400_000));
      } catch {
        coords = null;
      }
    }
    return { enlaceFinal: finalUrl, coordenadas: coords };
  }

  return {
    enlaceFinal: actual,
    coordenadas: extraerCoordenadasDeEnlace(actual),
  };
}
