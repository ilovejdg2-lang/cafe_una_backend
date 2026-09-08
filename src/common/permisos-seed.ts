export const ROLES_SISTEMA = [
  'SuperAdmin',
  'Admin',
  'Vendedor',
  'Cliente',
  'Usuario',
  'Visitante',
];

export const PERMISOS_SEED: Array<{
  codigo: string;
  nombre: string;
  roles: string[];
}> = [];

export const PERMISOS_PROTEGIDOS_SUPERADMIN: string[] = [];
export const PERMISOS_PUBLICOS_FIJOS: Record<string, string[]> = {};

export function construirMatrizDesdeSeed(): Record<string, string[]> {
  return {};
}
