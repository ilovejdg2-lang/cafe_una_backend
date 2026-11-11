import {
  esRolCliente,
  esRolStaffVenta,
  esRolSuperAdmin,
  usuarioEsStaffVenta,
} from './roles.util';

describe('roles.util', () => {
  it('detects staff sale roles case-insensitively', () => {
    expect(esRolStaffVenta('Vendedor')).toBe(true);
    expect(esRolStaffVenta('admin')).toBe(true);
    expect(esRolStaffVenta('SuperAdmin')).toBe(true);
    expect(esRolStaffVenta('Cliente')).toBe(false);
    expect(esRolSuperAdmin('superadministrador')).toBe(true);
    expect(esRolCliente('Cliente')).toBe(true);
  });

  it('checks the full roles array for staff sale access', () => {
    expect(usuarioEsStaffVenta(['Cliente'])).toBe(false);
    expect(usuarioEsStaffVenta(['Vendedor'])).toBe(true);
    expect(usuarioEsStaffVenta(['Cliente', 'Admin'])).toBe(true);
    expect(usuarioEsStaffVenta(null)).toBe(false);
  });
});
