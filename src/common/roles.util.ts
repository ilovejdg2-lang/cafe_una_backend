export function esRolSuperAdmin(rol: unknown): boolean {
  const valor = String(rol ?? "")
    .trim()
    .toLowerCase();
  return valor === "superadmin" || valor === "superadministrador";
}

export function esRolCliente(rol: unknown): boolean {
  return String(rol ?? "").trim().toLowerCase() === "cliente";
}

/** Vendedor, Admin o SuperAdmin: quien puede figurar como responsable de una venta. */
export function esRolStaffVenta(rol: unknown): boolean {
  const valor = String(rol ?? "")
    .trim()
    .toLowerCase();
  return (
    valor === "vendedor" ||
    valor === "admin" ||
    valor === "administrador" ||
    esRolSuperAdmin(valor)
  );
}

export function usuarioEsStaffVenta(roles: unknown): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((rol) => esRolStaffVenta(rol));
}
