import type { Response } from 'express';

const ORIGENES_VISOR =
  "'self' https://cafeunaing.netlify.app http://localhost:5173 http://127.0.0.1:5173";

/** Permite que el sitio muestre esta respuesta dentro de un iframe. */
export function permitirMarcoDelSitio(res: Response): void {
  res.removeHeader('X-Frame-Options');
  res.set({ 'Content-Security-Policy': `frame-ancestors ${ORIGENES_VISOR}` });
}
