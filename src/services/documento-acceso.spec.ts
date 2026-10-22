import { puedeVerDocumentoPrivado } from './documentos.service';

describe('acceso a documento privado', () => {
  it('acepta SuperAdmin aunque el token traiga role en texto', () => {
    expect(puedeVerDocumentoPrivado({ role: 'SuperAdmin' })).toBe(true);
    expect(puedeVerDocumentoPrivado({ role: ['SuperAdmin'] })).toBe(true);
  });

  it('acepta Admin y niega Vendedor y Cliente', () => {
    expect(puedeVerDocumentoPrivado({ role: 'Admin' })).toBe(true);
    expect(puedeVerDocumentoPrivado({ roles: ['Vendedor'] })).toBe(false);
    expect(puedeVerDocumentoPrivado({ role: 'Cliente' })).toBe(false);
    expect(puedeVerDocumentoPrivado(null)).toBe(false);
  });
});
