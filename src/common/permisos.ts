export const ROLES = [
  'SuperAdmin',
  'Admin',
  'Vendedor',
  'Cliente',
  'Usuario',
  'Visitante',
] as const;

export type RolNombre = (typeof ROLES)[number];

const SA = 'SuperAdmin';
const AD = 'Admin';
const VE = 'Vendedor';
const CL = 'Cliente';
const US = 'Usuario';
const VI = 'Visitante';

const todos = [SA, AD, VE, CL, US, VI] as const;
const logueados = [SA, AD, VE, CL, US] as const;
const staff = [SA, AD, VE] as const;
const admins = [SA, AD] as const;

export const PERMISOS_POR_ROL: Record<string, readonly string[]> = {
  ver_informacion: todos,
  agregar_imagenes_galeria: admins,
  actualizar_informacion: admins,
  inactivar_informacion: admins,
  ver_panel_administrativo: staff,
  crear_usuarios: [SA],
  editar_usuarios: [SA],
  inactivar_usuarios: [SA],
  asignar_roles: [SA],
  administrar_roles_permisos: [SA],
  actualizar_perfil_propio: logueados,
  cambiar_contrasena_propia: logueados,
  ver_perfil_propio: logueados,
  ver_panel_usuario_propio: logueados,
  registrar_ventas: staff,
  actualizar_ventas: staff,
  ver_ventas: staff,
  cancelar_ventas: staff,
  ver_reportes: staff,
  ver_productos: todos,
  crear_productos: [SA],
  comprar_productos: [CL],
  actualizar_stock_productos: staff,
  ajustar_stock_ubicaciones: admins,
  actualizar_productos: admins,
  inactivar_productos: admins,
  ver_historial_compras_clientes: staff,
  ver_historial_compras_propio: [CL],
  ver_inventario: admins,
  actualizar_inventario: admins,
  agregar_articulo_inventario: admins,
  inactivar_articulo_inventario: admins,
  ver_productores: todos,
  administrar_solicitudes_productores: admins,
  agregar_productor: admins,
  actualizar_productor: [SA],
  inactivar_productor: [SA],
  ver_todas_las_facturas: staff,
  crear_facturas_hacienda: staff,
  ver_factura_propia: staff,
  crear_su_propia_factura: staff,
  actualizar_facturas: staff,
  descargar_su_propia_factura: [SA, AD, VE, CL],
  descargar_facturas: staff,
  inactivar_facturas: staff,
  ver_documentacion_visible: todos,
  ver_documentacion_privada: admins,
  crear_documentacion: admins,
  actualizar_documentacion: admins,
  administrar_solicitudes_documentacion: admins,
  inactivar_documentacion: [SA],
  administrar_solicitudes_visitantes: admins,
  crear_solicitud_visitante: logueados,
  actualizar_visitas: [SA],
  inactivar_visita: [SA],
  ver_solicitudes_voluntariado: admins,
  ingresar_solicitud_voluntariado: logueados,
  administrar_solicitudes_voluntariado: admins,
  actualizar_solicitud_voluntariado: [SA],
  inactivar_voluntariado: [SA],
  ver_solicitudes_donacion: admins,
  hacer_solicitud_donacion: logueados,
  administrar_solicitudes_donaciones: admins,
  actualizar_solicitud_donaciones: [SA],
  inactivar_donacion: admins,
  ver_auditoria: [SA],
};

export type JwtUsuario = {
  userId: number;
  roles: string[];
};

function normalizarRol(rol: string): string {
  const valor = (rol ?? '').trim().toLowerCase();
  if (valor === 'superadmin') return SA;
  if (valor === 'admin') return AD;
  if (valor === 'vendedor') return VE;
  if (valor === 'cliente') return CL;
  if (valor === 'usuario') return US;
  if (valor === 'visitante') return VI;
  return (rol ?? '').trim();
}

export function tienePermiso(
  roles: string[] | null | undefined,
  codigo: string,
): boolean {
  const permitidos = PERMISOS_POR_ROL[codigo];
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
