export function esRolSuperAdmin(rol: unknown): boolean {
  const valor = String(rol ?? "")
    .trim()
    .toLowerCase();
  return valor === "superadmin" || valor === "superadministrador";
}

export function esRolCliente(rol: unknown): boolean {
  return String(rol ?? "").trim().toLowerCase() === "cliente";
}
