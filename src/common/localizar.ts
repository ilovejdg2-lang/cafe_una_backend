/** Aplica textos en inglés sobre los campos base si existen; si no, deja el español. */
export function localizarRegistro<T extends Record<string, unknown>>(
  registro: T,
  campos: string[],
  lang: string,
): T {
  if (!registro || String(lang || 'es').toLowerCase() !== 'en') {
    return { ...registro };
  }
  const out = { ...registro };
  for (const campo of campos) {
    const en = out[`${campo}En`];
    if (typeof en === 'string' && en.trim()) {
      (out as Record<string, unknown>)[campo] = en.trim();
    }
  }
  return out;
}

export function normalizarIdioma(valor: unknown): 'es' | 'en' {
  const v = String(valor ?? 'es').trim().toLowerCase();
  return v === 'en' ? 'en' : 'es';
}

export const CAMPOS_HERO = [
  'Eyebrow',
  'Title',
  'Subtitle',
  'PrimaryButtonText',
  'ButtonText',
] as const;

export const CAMPOS_TARJETA = [
  'Etiqueta',
  'Titulo',
  'Descripcion',
  'TextoBoton',
] as const;

export const CAMPOS_TEXTO = [
  'Eyebrow',
  'Title',
  'Description',
  'LinkText',
] as const;

export const CAMPOS_ENLACE = ['Etiqueta'] as const;

export const CAMPOS_FOOTER = ['FraseMarca', 'TextoCopyright'] as const;

export const CAMPOS_PRODUCTO = ['Nombre', 'Descripcion'] as const;
