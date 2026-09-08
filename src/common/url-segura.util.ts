export function normalizarRutaSegura(ruta?: string): string {
  if (!ruta) return '';
  const trimmed = ruta.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
