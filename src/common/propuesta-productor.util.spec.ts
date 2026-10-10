import {
  aceptaTerminos,
  detectarImagenReal,
  normalizarTelefonoContacto,
  normalizarWhatsapp,
  validarDescripcion,
  validarEnlaceUbicacion,
  validarPropuestaEntrada,
  validarSitioWeb,
  DESCRIPCION_MAX,
  assertTransicionDesdePendiente,
} from './propuesta-productor.util';
import { PERMISOS_SEED } from './permisos-seed';
import { contenidoCorreoPropuesta } from './propuesta-correo';

describe('propuesta de productor', () => {
  const base = {
    nombre: '  Cafetal Don Juan  ',
    provincia: 'San José',
    canton: 'Desamparados',
    distrito: 'San Miguel',
    direccion: 'Frente al parque',
    enlaceUbicacion: 'https://maps.google.com/maps?q=cafe',
    descripcion: 'Café de altura y tueste propio.',
    correo: 'hola@cafetal.com',
    telefono: '8888-8888',
    aceptaTerminos: 'true',
  };

  it('normaliza el nombre y deja la propuesta pendiente de reglas de términos', () => {
    const datos = validarPropuestaEntrada(base);
    expect(datos.nombre).toBe('Cafetal Don Juan');
    expect(datos.telefono).toBe('+50688888888');
    expect(datos.aceptaTerminos).toBe(true);
  });

  it('rechaza un nombre vacío y una descripción que supera el límite', () => {
    expect(() => validarPropuestaEntrada({ ...base, nombre: '   ' })).toThrow(
      /obligatorio/,
    );
    expect(() => validarDescripcion('a'.repeat(DESCRIPCION_MAX + 1))).toThrow(
      /2000/,
    );
  });

  it('acepta enlaces https de Maps y Waze y rechaza dominios parecidos', () => {
    expect(validarEnlaceUbicacion('https://www.google.com/maps/place/Cafe')).toContain(
      'google.com/maps',
    );
    expect(validarEnlaceUbicacion('https://goo.gl/maps/abc')).toContain('goo.gl/maps');
    expect(validarEnlaceUbicacion('https://maps.app.goo.gl/abc')).toContain(
      'maps.app.goo.gl',
    );
    expect(validarEnlaceUbicacion('https://waze.com/ul/abc')).toContain('waze.com');
    expect(() =>
      validarEnlaceUbicacion('https://maps.google.com.ejemplo.com/maps'),
    ).toThrow(/Google Maps o Waze/);
    expect(() => validarEnlaceUbicacion('javascript:alert(1)')).toThrow();
  });

  it('no exige redes vacías y rechaza javascript o un sitio sin host', () => {
    const datos = validarPropuestaEntrada({
      ...base,
      facebook: '',
      instagram: 'https://www.instagram.com/cafetal',
      whatsapp: '',
      sitioWeb: '',
    });
    expect(datos.facebook).toBeNull();
    expect(datos.whatsapp).toBeNull();
    expect(datos.instagram).toContain('instagram.com/cafetal');
    expect(() =>
      validarPropuestaEntrada({ ...base, facebook: 'javascript:alert(1)' }),
    ).toThrow();
    expect(() => validarSitioWeb('https://localhost')).toThrow();
  });

  it('arma el enlace de WhatsApp solo con los dígitos validados', () => {
    expect(normalizarWhatsapp('+506 8888-8888')).toBe('https://wa.me/50688888888');
    expect(normalizarWhatsapp('')).toBeNull();
    expect(() => normalizarWhatsapp('88888888')).toThrow(/código de país/);
  });

  it('reconoce el contenido real de la imagen y no solo la extensión', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(detectarImagenReal(jpeg).mime).toBe('image/jpeg');
    const falso = Buffer.from('not-an-image!!');
    expect(() => detectarImagenReal(falso)).toThrow(/JPG, JPEG, PNG o WebP/);
  });

  it('exige el checkbox de términos desmarcado hasta que se acepte', () => {
    expect(() => aceptaTerminos(false)).toThrow(/autorización/);
    expect(aceptaTerminos(true)).toBe(true);
  });

  it('impide una segunda revisión cuando ya no está pendiente', () => {
    expect(() => assertTransicionDesdePendiente('Aprobada')).toThrow(/ya fue revisada/);
    expect(() => assertTransicionDesdePendiente('Pendiente')).not.toThrow();
  });

  it('no entrega la revisión administrativa al rol vendedor', () => {
    const permiso = PERMISOS_SEED.find(
      (item) => item.codigo === 'administrar_solicitudes_productores',
    );
    expect(permiso?.roles).toEqual(['SuperAdmin', 'Admin']);
    expect(permiso?.roles).not.toContain('Vendedor');
  });

  it('escapa el motivo del rechazo dentro del correo', () => {
    const correo = contenidoCorreoPropuesta({
      nombreEmprendimiento: '<b>Cafe</b>',
      id: '15',
      resultado: 'Rechazada',
      fechaRevision: '10/10/2026, 08:00',
      enlaceMisPropuestas: 'https://cafe.una/perfil/propuestas/15',
      motivo: '<script>alert(1)</script>',
      correoInstitucional: 'contacto@cafeuna.ac.cr',
    });
    expect(correo.html).toContain('&lt;script&gt;');
    expect(correo.html).not.toContain('<script>');
    expect(correo.html).toContain('contacto@cafeuna.ac.cr');
    expect(correo.texto).toContain('Motivo del rechazo');
  });

  it('normaliza un teléfono internacional', () => {
    expect(normalizarTelefonoContacto('+1 (415) 555-2671')).toBe('+14155552671');
  });
});
