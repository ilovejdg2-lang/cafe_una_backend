export type TipoCliente = 'persona' | 'empresa';
export type TipoDocumentoPersona = 'cedula' | 'dimex' | 'pasaporte';

export type DatosClienteRegistro = {
  tipo: TipoCliente;
  telefono: string;
  aceptoTerminos: boolean;
  aceptoPrivacidad: boolean;
  nombreLegal?: string;
  apellidos?: string;
  identificacion?: string;
  tipoDocumento?: TipoDocumentoPersona;
  razonSocial?: string;
  nombreComercial?: string;
  representanteLegal?: string;
  cedulaJuridica?: string;
  direccionFiscal?: string;
  telefonoOficina?: string;
};

const TELEFONO_RE = /^(\+?\d{1,3}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}$/;
const NOMBRE_PERSONA_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/;
const CEDULA_JURIDICA_RE = /^\d{1}-\d{3}-\d{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASAPORTE_RE = /^[A-Za-z0-9]{5,20}$/;
const DIMEX_RE = /^\d{10,12}$/;

export function validarPasswordCliente(password: string): void {
  if (!password) throw new Error('La contraseña es obligatoria.');
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }
  if (!/[A-ZÁÉÍÓÚÜÑ]/.test(password)) {
    throw new Error('La contraseña debe incluir al menos una mayúscula.');
  }
  if (!/\d/.test(password)) {
    throw new Error('La contraseña debe incluir al menos un número.');
  }
  if (!/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s]/.test(password)) {
    throw new Error('La contraseña debe incluir al menos un carácter especial.');
  }
}

export function validarCorreoCliente(correo: string): string {
  const valor = correo.trim().toLowerCase();
  if (!valor) throw new Error('El correo es obligatorio.');
  if (!EMAIL_RE.test(valor)) throw new Error('El correo no tiene un formato válido.');
  return valor;
}

export function validarTelefono(telefono: string, obligatorio = true): string {
  const valor = telefono.trim();
  if (!valor) {
    if (obligatorio) throw new Error('El teléfono es obligatorio.');
    return '';
  }
  if (!TELEFONO_RE.test(valor) || valor.replace(/\D/g, '').length < 8) {
    throw new Error('El teléfono no tiene un formato válido.');
  }
  return valor;
}

function resolverTipoDocumento(raw: Record<string, unknown>): TipoDocumentoPersona {
  const esNacionalRaw = String(raw.esNacional ?? raw.EsNacional ?? '')
    .trim()
    .toLowerCase();
  const tipoDocRaw = String(raw.tipoDocumento ?? raw.TipoDocumento ?? '')
    .trim()
    .toLowerCase();

  if (tipoDocRaw === 'cedula' || tipoDocRaw === 'cédula') return 'cedula';
  if (tipoDocRaw === 'dimex') return 'dimex';
  if (tipoDocRaw === 'pasaporte') return 'pasaporte';
  if (esNacionalRaw === 'si' || esNacionalRaw === 'true' || esNacionalRaw === '1') {
    return 'cedula';
  }
  if (esNacionalRaw === 'no' || esNacionalRaw === 'false' || esNacionalRaw === '0') {
    return 'pasaporte';
  }
  return 'cedula';
}

export function validarDatosCliente(raw: Record<string, unknown>): {
  nombre: string;
  datos: DatosClienteRegistro;
} {
  const tipoRaw = String(raw.tipo ?? raw.Tipo ?? '')
    .trim()
    .toLowerCase();
  const tipo: TipoCliente =
    tipoRaw === 'empresa' || tipoRaw === 'juridica' || tipoRaw === 'jurídica'
      ? 'empresa'
      : tipoRaw === 'persona' || tipoRaw === 'natural'
        ? 'persona'
        : ('' as TipoCliente);

  if (tipo !== 'persona' && tipo !== 'empresa') {
    throw new Error('Debe elegir persona natural o empresa.');
  }

  const telefono = validarTelefono(String(raw.telefono ?? raw.Telefono ?? ''));
  const aceptoTerminos = Boolean(raw.aceptoTerminos ?? raw.AceptoTerminos);
  const aceptoPrivacidad = Boolean(raw.aceptoPrivacidad ?? raw.AceptoPrivacidad);
  if (!aceptoTerminos) throw new Error('Debe aceptar los términos y condiciones.');
  if (!aceptoPrivacidad) throw new Error('Debe aceptar las políticas de privacidad.');

  if (tipo === 'persona') {
    const tipoDocumento = resolverTipoDocumento(raw);
    const esNacional = tipoDocumento === 'cedula';

    const nombre = String(raw.nombre ?? raw.Nombre ?? '').trim();
    if (!nombre) throw new Error('El nombre es obligatorio.');
    if (nombre.length > 100) {
      throw new Error('El nombre no puede superar 100 caracteres.');
    }
    if (!NOMBRE_PERSONA_RE.test(nombre)) {
      throw new Error('El nombre solo puede incluir letras y espacios.');
    }
    const apellido1 = String(raw.apellido1 ?? raw.Apellido1 ?? '').trim();
    const apellido2 = String(raw.apellido2 ?? raw.Apellido2 ?? '').trim();
    if (!apellido1) throw new Error('El apellido 1 es obligatorio.');
    if (esNacional && !apellido2) {
      throw new Error('El apellido 2 es obligatorio.');
    }
    if (!NOMBRE_PERSONA_RE.test(apellido1)) {
      throw new Error('El apellido 1 solo puede incluir letras y espacios.');
    }
    if (apellido2 && !NOMBRE_PERSONA_RE.test(apellido2)) {
      throw new Error('El apellido 2 solo puede incluir letras y espacios.');
    }
    const apellidos = [apellido1, apellido2].filter(Boolean).join(' ').trim();

    let identificacion = String(raw.identificacion ?? raw.Identificacion ?? '').trim();
    if (!identificacion) {
      throw new Error('El número de identificación es obligatorio.');
    }
    if (tipoDocumento === 'cedula') {
      identificacion = identificacion.replace(/\D/g, '');
      if (!/^\d{9}$/.test(identificacion)) {
        throw new Error('La cédula costarricense debe tener 9 dígitos.');
      }
    } else if (tipoDocumento === 'dimex') {
      identificacion = identificacion.replace(/\D/g, '');
      if (!DIMEX_RE.test(identificacion)) {
        throw new Error('El DIMEX debe tener entre 10 y 12 dígitos.');
      }
    } else if (!PASAPORTE_RE.test(identificacion)) {
      throw new Error('El pasaporte no tiene un formato válido.');
    }

    return {
      nombre: `${nombre} ${apellidos}`.trim(),
      datos: {
        tipo,
        telefono,
        aceptoTerminos,
        aceptoPrivacidad,
        nombreLegal: nombre,
        apellidos,
        identificacion,
        tipoDocumento,
      },
    };
  }

  const razonSocial = String(raw.razonSocial ?? raw.RazonSocial ?? '').trim();
  const nombreComercial = String(
    raw.nombreComercial ?? raw.NombreComercial ?? '',
  ).trim();
  const representanteLegal = String(
    raw.representanteLegal ?? raw.RepresentanteLegal ?? '',
  ).trim();
  const cedulaJuridica = String(
    raw.cedulaJuridica ?? raw.CedulaJuridica ?? '',
  ).trim();
  if (!razonSocial) throw new Error('La razón social es obligatoria.');
  if (!nombreComercial) throw new Error('El nombre comercial es obligatorio.');
  if (!representanteLegal) {
    throw new Error('El nombre del representante legal es obligatorio.');
  }
  if (!cedulaJuridica) throw new Error('La cédula jurídica es obligatoria.');
  if (!CEDULA_JURIDICA_RE.test(cedulaJuridica)) {
    throw new Error('La cédula jurídica debe tener el formato 3-101-123456.');
  }
  const direccionFiscal = String(
    raw.direccionFiscal ?? raw.DireccionFiscal ?? '',
  ).trim();
  const telefonoOficina = validarTelefono(
    String(raw.telefonoOficina ?? raw.TelefonoOficina ?? ''),
    false,
  );

  return {
    nombre: (nombreComercial || razonSocial).slice(0, 100),
    datos: {
      tipo,
      telefono,
      aceptoTerminos,
      aceptoPrivacidad,
      razonSocial,
      nombreComercial,
      representanteLegal,
      cedulaJuridica,
      direccionFiscal: direccionFiscal || undefined,
      telefonoOficina: telefonoOficina || undefined,
    },
  };
}

/** Edición de ficha ya registrada: no pide términos ni nombre de cuenta. */
export function validarDatosClienteEdicion(
  tipo: TipoCliente,
  raw: Record<string, unknown>,
): DatosClienteRegistro {
  if (tipo !== 'persona' && tipo !== 'empresa') {
    throw new Error('Tipo de cliente inválido.');
  }

  const telefono = validarTelefono(String(raw.telefono ?? raw.Telefono ?? ''));

  if (tipo === 'persona') {
    const tipoDocumento = resolverTipoDocumento(raw);
    const nombreLegal = String(raw.nombreLegal ?? raw.NombreLegal ?? raw.nombre ?? raw.Nombre ?? '')
      .trim();
    if (!nombreLegal) throw new Error('El nombre es obligatorio.');
    if (nombreLegal.length > 100) {
      throw new Error('El nombre no puede superar 100 caracteres.');
    }
    if (!NOMBRE_PERSONA_RE.test(nombreLegal)) {
      throw new Error('El nombre solo puede incluir letras y espacios.');
    }

    const apellido1 = String(raw.apellido1 ?? raw.Apellido1 ?? '').trim();
    const apellido2 = String(raw.apellido2 ?? raw.Apellido2 ?? '').trim();
    const apellidosRaw = String(raw.apellidos ?? raw.Apellidos ?? '').trim();
    const apellidos =
      apellidosRaw ||
      [apellido1, apellido2].filter(Boolean).join(' ').trim();

    if (!apellidos) throw new Error('Los apellidos son obligatorios.');
    if (!NOMBRE_PERSONA_RE.test(apellidos)) {
      throw new Error('Los apellidos solo pueden incluir letras y espacios.');
    }
    if (apellidos.length > 100) {
      throw new Error('Los apellidos no pueden superar 100 caracteres.');
    }
    if (tipoDocumento === 'cedula' && !apellidosRaw && !apellido2) {
      throw new Error('El apellido 2 es obligatorio.');
    }

    let identificacion = String(raw.identificacion ?? raw.Identificacion ?? '').trim();
    if (!identificacion) {
      throw new Error('El número de identificación es obligatorio.');
    }
    if (tipoDocumento === 'cedula') {
      identificacion = identificacion.replace(/\D/g, '');
      if (!/^\d{9}$/.test(identificacion)) {
        throw new Error('La cédula costarricense debe tener 9 dígitos.');
      }
    } else if (tipoDocumento === 'dimex') {
      identificacion = identificacion.replace(/\D/g, '');
      if (!DIMEX_RE.test(identificacion)) {
        throw new Error('El DIMEX debe tener entre 10 y 12 dígitos.');
      }
    } else if (!PASAPORTE_RE.test(identificacion)) {
      throw new Error('El pasaporte no tiene un formato válido.');
    }

    return {
      tipo,
      telefono,
      aceptoTerminos: true,
      aceptoPrivacidad: true,
      nombreLegal,
      apellidos,
      identificacion,
      tipoDocumento,
    };
  }

  const razonSocial = String(raw.razonSocial ?? raw.RazonSocial ?? '').trim();
  const nombreComercial = String(
    raw.nombreComercial ?? raw.NombreComercial ?? '',
  ).trim();
  const representanteLegal = String(
    raw.representanteLegal ?? raw.RepresentanteLegal ?? '',
  ).trim();
  const cedulaJuridica = String(
    raw.cedulaJuridica ?? raw.CedulaJuridica ?? '',
  ).trim();
  if (!razonSocial) throw new Error('La razón social es obligatoria.');
  if (!nombreComercial) throw new Error('El nombre comercial es obligatorio.');
  if (!representanteLegal) {
    throw new Error('El nombre del representante legal es obligatorio.');
  }
  if (!cedulaJuridica) throw new Error('La cédula jurídica es obligatoria.');
  if (!CEDULA_JURIDICA_RE.test(cedulaJuridica)) {
    throw new Error('La cédula jurídica debe tener el formato 3-101-123456.');
  }
  const direccionFiscal = String(
    raw.direccionFiscal ?? raw.DireccionFiscal ?? '',
  ).trim();
  const telefonoOficina = validarTelefono(
    String(raw.telefonoOficina ?? raw.TelefonoOficina ?? ''),
    false,
  );

  return {
    tipo,
    telefono,
    aceptoTerminos: true,
    aceptoPrivacidad: true,
    razonSocial,
    nombreComercial,
    representanteLegal,
    cedulaJuridica,
    direccionFiscal: direccionFiscal || undefined,
    telefonoOficina: telefonoOficina || undefined,
  };
}
