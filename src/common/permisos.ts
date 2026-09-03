import {
  construirMatrizDesdeSeed,
  ROLES_SISTEMA,
} from './permisos-seed';

export const ROLES = [...ROLES_SISTEMA] as const;

export type RolNombre = (typeof ROLES)[number];

/** Matriz en memoria (BD la refresca vía PermisosCatalogoService). */
let matrizActual: Record<string, readonly string[]> = construirMatrizDesdeSeed();

export const PERMISOS_POR_ROL: Record<string, readonly string[]> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      return matrizActual[prop];
    },
    ownKeys() {
      return Reflect.ownKeys(matrizActual);
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (prop in matrizActual || Object.prototype.hasOwnProperty.call(matrizActual, prop)) {
        return {
          configurable: true,
          enumerable: true,
          value: matrizActual[prop as string],
        };
      }
      return undefined;
    },
  },
) as Record<string, readonly string[]>;

export function reemplazarMatrizPermisos(
  matriz: Record<string, readonly string[]>,
): void {
  matrizActual = { ...matriz };
}

export function obtenerMatrizPermisos(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(matrizActual)) {
    out[k] = [...v];
  }
  return out;
}

export type JwtUsuario = {
  userId: number;
  roles: string[];
};

function normalizarRol(rol: string): string {
  const valor = (rol ?? '').trim().toLowerCase();
  if (valor === 'superadmin') return 'SuperAdmin';
  if (valor === 'admin') return 'Admin';
  if (valor === 'vendedor') return 'Vendedor';
  if (valor === 'cliente') return 'Cliente';
  if (valor === 'usuario') return 'Usuario';
  return (rol ?? '').trim();
}

export function tienePermiso(
  roles: string[] | null | undefined,
  codigo: string,
): boolean {
  const permitidos = matrizActual[codigo];
  if (!permitidos) return false;
  const propios = (roles ?? []).map(normalizarRol);
  return permitidos.some((rol) => propios.includes(rol));
}

export function tieneAlgunPermiso(
  roles: string[] | null | undefined,
  codigos: string[],
): boolean {
  return codigos.some((codigo) => tienePermiso(roles, codigo));
}
