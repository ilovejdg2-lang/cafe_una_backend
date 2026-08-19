export type UsuarioSeed = {
  id: number;
  nombre: string;
  correo: string;
  password: string;
  estado: string;
  roles: string[];
  fotoPerfilUrl: string | null;
  fotoBannerUrl: string | null;
  fotoPerfilPosicion: string | null;
  fotoBannerPosicion: string | null;
};

function cargarUsuariosLocales(): UsuarioSeed[] {
  try {
    // Cuentas reales viven en usuarios-seed.local.ts (gitignored).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const local = require('./usuarios-seed.local') as { USUARIOS_VIEJOS?: UsuarioSeed[] };
    return Array.isArray(local.USUARIOS_VIEJOS) ? local.USUARIOS_VIEJOS : [];
  } catch {
    return [];
  }
}

export const USUARIOS_VIEJOS: UsuarioSeed[] = cargarUsuariosLocales();
