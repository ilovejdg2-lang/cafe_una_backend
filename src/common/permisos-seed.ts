/**
 * Matriz operativa de permisos (sin Visitante: no es rol).
 * Excluye lecturas públicas del sitio (ver_informacion, ver_productos, etc.).
 */
export const ROLES_SISTEMA = [
  'SuperAdmin',
  'Admin',
  'Vendedor',
  'Cliente',
  'Usuario',
] as const;

export type RolSistema = (typeof ROLES_SISTEMA)[number];

const SA = 'SuperAdmin';
const AD = 'Admin';
const VE = 'Vendedor';
const CL = 'Cliente';
const US = 'Usuario';

const staff = [SA, AD, VE] as const;
const admins = [SA, AD] as const;
const logueados = [SA, AD, VE, CL, US] as const;

export type PermisoSeed = {
  codigo: string;
  nombre: string;
  roles: readonly string[];
};

/** Solo permisos que importan en la matriz admin. */
export const PERMISOS_SEED: readonly PermisoSeed[] = [
  {
    codigo: 'agregar_imagenes_galeria',
    nombre: 'Agregar imágenes a galería de fotos',
    roles: admins,
  },
  {
    codigo: 'actualizar_informacion',
    nombre: 'Actualizar información',
    roles: admins,
  },
  {
    codigo: 'inactivar_informacion',
    nombre: 'Inactivar información',
    roles: admins,
  },
  {
    codigo: 'ver_panel_administrativo',
    nombre: 'Ver panel administrativo',
    roles: staff,
  },
  { codigo: 'crear_usuarios', nombre: 'Crear usuarios', roles: [SA] },
  { codigo: 'editar_usuarios', nombre: 'Editar usuarios', roles: [SA] },
  { codigo: 'inactivar_usuarios', nombre: 'Inactivar usuarios', roles: [SA] },
  { codigo: 'asignar_roles', nombre: 'Asignar roles', roles: [SA] },
  {
    codigo: 'administrar_roles_permisos',
    nombre: 'Administrar roles y permisos',
    roles: [SA],
  },
  {
    codigo: 'actualizar_perfil_propio',
    nombre: 'Actualizar perfil propio',
    roles: logueados,
  },
  {
    codigo: 'cambiar_contrasena_propia',
    nombre: 'Cambiar contraseña propia',
    roles: logueados,
  },
  {
    codigo: 'ver_perfil_propio',
    nombre: 'Ver perfil propio',
    roles: logueados,
  },
  {
    codigo: 'ver_panel_usuario_propio',
    nombre: 'Ver panel de usuario propio',
    roles: logueados,
  },
  { codigo: 'registrar_ventas', nombre: 'Registrar ventas', roles: staff },
  { codigo: 'actualizar_ventas', nombre: 'Actualizar ventas', roles: staff },
  { codigo: 'ver_ventas', nombre: 'Ver ventas', roles: staff },
  { codigo: 'cancelar_ventas', nombre: 'Cancelar ventas', roles: staff },
  { codigo: 'ver_reportes', nombre: 'Ver reportes', roles: staff },
  { codigo: 'crear_productos', nombre: 'Crear productos', roles: [SA] },
  { codigo: 'comprar_productos', nombre: 'Comprar productos', roles: [CL] },
  {
    codigo: 'actualizar_stock_productos',
    nombre: 'Actualizar stock de productos',
    roles: staff,
  },
  {
    codigo: 'ajustar_stock_ubicaciones',
    nombre: 'Ajustar stock por ubicaciones',
    roles: staff,
  },
  { codigo: 'actualizar_productos', nombre: 'Actualizar productos', roles: admins },
  { codigo: 'inactivar_productos', nombre: 'Inactivar productos', roles: admins },
  {
    codigo: 'ver_historial_compras_clientes',
    nombre: 'Ver historial de compras de clientes',
    roles: staff,
  },
  {
    codigo: 'ver_historial_compras_propio',
    nombre: 'Ver historial de compras propio',
    roles: [CL],
  },
  { codigo: 'ver_inventario', nombre: 'Ver inventario', roles: admins },
  {
    codigo: 'actualizar_inventario',
    nombre: 'Actualizar inventario',
    roles: admins,
  },
  {
    codigo: 'agregar_articulo_inventario',
    nombre: 'Agregar artículo de inventario',
    roles: admins,
  },
  {
    codigo: 'inactivar_articulo_inventario',
    nombre: 'Inactivar artículo de inventario',
    roles: admins,
  },
  {
    codigo: 'administrar_solicitudes_productores',
    nombre: 'Administrar solicitudes de productores',
    roles: admins,
  },
  { codigo: 'agregar_productor', nombre: 'Agregar productor', roles: admins },
  { codigo: 'actualizar_productor', nombre: 'Actualizar productor', roles: [SA] },
  { codigo: 'inactivar_productor', nombre: 'Inactivar productor', roles: [SA] },
  {
    codigo: 'ver_todas_las_facturas',
    nombre: 'Ver todas las facturas',
    roles: staff,
  },
  {
    codigo: 'crear_facturas_hacienda',
    nombre: 'Crear facturas hacienda',
    roles: staff,
  },
  { codigo: 'ver_factura_propia', nombre: 'Ver factura propia', roles: staff },
  {
    codigo: 'crear_su_propia_factura',
    nombre: 'Crear su propia factura',
    roles: staff,
  },
  { codigo: 'actualizar_facturas', nombre: 'Actualizar facturas', roles: staff },
  {
    codigo: 'descargar_su_propia_factura',
    nombre: 'Descargar su propia factura',
    roles: [SA, AD, VE, CL],
  },
  { codigo: 'descargar_facturas', nombre: 'Descargar facturas', roles: staff },
  { codigo: 'inactivar_facturas', nombre: 'Inactivar facturas', roles: staff },
  {
    codigo: 'ver_documentacion_privada',
    nombre: 'Ver documentación privada',
    roles: admins,
  },
  { codigo: 'crear_documentacion', nombre: 'Crear documentación', roles: admins },
  {
    codigo: 'actualizar_documentacion',
    nombre: 'Actualizar documentación',
    roles: admins,
  },
  {
    codigo: 'administrar_solicitudes_documentacion',
    nombre: 'Administrar solicitudes de documentación',
    roles: admins,
  },
  {
    codigo: 'inactivar_documentacion',
    nombre: 'Inactivar documentación',
    roles: [SA],
  },
  {
    codigo: 'administrar_solicitudes_visitantes',
    nombre: 'Administrar solicitudes de visitantes',
    roles: admins,
  },
  {
    codigo: 'crear_solicitud_visitante',
    nombre: 'Crear solicitud de visitante',
    roles: logueados,
  },
  { codigo: 'actualizar_visitas', nombre: 'Actualizar visitas', roles: [SA] },
  { codigo: 'inactivar_visita', nombre: 'Inactivar visita', roles: [SA] },
  {
    codigo: 'ver_solicitudes_voluntariado',
    nombre: 'Ver solicitudes de voluntariado',
    roles: admins,
  },
  {
    codigo: 'ingresar_solicitud_voluntariado',
    nombre: 'Ingresar una solicitud de voluntariado',
    roles: logueados,
  },
  {
    codigo: 'administrar_solicitudes_voluntariado',
    nombre: 'Administrar solicitudes de voluntariado',
    roles: admins,
  },
  {
    codigo: 'actualizar_solicitud_voluntariado',
    nombre: 'Actualizar una solicitud de voluntariado',
    roles: [SA],
  },
  {
    codigo: 'inactivar_voluntariado',
    nombre: 'Inactivar voluntariado',
    roles: [SA],
  },
  {
    codigo: 'ver_solicitudes_donacion',
    nombre: 'Ver solicitudes de donación',
    roles: admins,
  },
  {
    codigo: 'hacer_solicitud_donacion',
    nombre: 'Hacer solicitud de donación',
    roles: logueados,
  },
  {
    codigo: 'administrar_solicitudes_donaciones',
    nombre: 'Administrar solicitud de donaciones',
    roles: admins,
  },
  {
    codigo: 'actualizar_solicitud_donaciones',
    nombre: 'Actualizar solicitud de donaciones',
    roles: [SA],
  },
  { codigo: 'inactivar_donacion', nombre: 'Inactivar donación', roles: admins },
  { codigo: 'ver_auditoria', nombre: 'Ver bitácoras', roles: [SA] },
];

/** Lecturas públicas: no van en la matriz editable; se otorgan a todos los roles. */
export const PERMISOS_PUBLICOS_FIJOS: Record<string, readonly string[]> = {
  ver_informacion: [...ROLES_SISTEMA],
  ver_productos: [...ROLES_SISTEMA],
  ver_productores: [...ROLES_SISTEMA],
  ver_documentacion_visible: [...ROLES_SISTEMA],
};

export function construirMatrizDesdeSeed(): Record<string, string[]> {
  const matriz: Record<string, string[]> = {};
  for (const p of PERMISOS_SEED) {
    matriz[p.codigo] = [...p.roles];
  }
  for (const [codigo, roles] of Object.entries(PERMISOS_PUBLICOS_FIJOS)) {
    matriz[codigo] = [...roles];
  }
  return matriz;
}

export const PERMISOS_PROTEGIDOS_SUPERADMIN = [
  'administrar_roles_permisos',
  'ver_panel_administrativo',
] as const;
