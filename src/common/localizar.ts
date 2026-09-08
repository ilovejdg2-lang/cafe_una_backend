export function normalizarIdioma(idioma?: any): string {
  const lower = String(idioma ?? '').trim().toLowerCase();
  return lower === 'en' ? 'en' : 'es';
}
