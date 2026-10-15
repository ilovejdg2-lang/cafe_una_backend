import { escapeHtml } from './propuesta-productor.util';

export type DatosCorreoPropuesta = {
  nombreEmprendimiento: string;
  id: string;
  resultado: 'Aprobada' | 'Rechazada';
  fechaRevision: string;
  enlaceMisPropuestas: string;
  /** Aprobada: ficha publicada en la sección de productores. */
  enlacePerfilPublico?: string | null;
  /** Rechazada: formulario para enviar una nueva propuesta. */
  enlaceNuevaPropuesta?: string | null;
  motivo?: string | null;
  sugerencias?: string | null;
  nombreUsuario?: string | null;
  correoInstitucional?: string | null;
  telefonoInstitucional?: string | null;
};

export type DatosCorreoRecepcionPropuesta = {
  nombreEmprendimiento: string;
  id: string;
  fechaEnvio: string;
  enlaceMisPropuestas: string;
  nombreUsuario?: string | null;
  correoInstitucional?: string | null;
  telefonoInstitucional?: string | null;
};

type Acento = { color: string; suave: string };

/** Mismo diseño que los correos de código (Templates/Email/codigo-verificacion.html), con otro color de acento. */
const ACENTOS = {
  recepcion: { color: '#8a5a2b', suave: '#fbf6f0' },
  aprobada: { color: '#286f54', suave: '#f1f7f4' },
  rechazada: { color: '#C41E3A', suave: '#fdf2f4' },
} satisfies Record<string, Acento>;

/** EmailService.enviar lo cambia por el logo guardado en informacion_navbar. */
const LOGO_URL = '{{logoUrl}}';

type DatoFila = { etiqueta: string; valor: string };

type Plantilla = {
  acento: Acento;
  titulo: string;
  saludo: string;
  mensaje: string;
  id: string;
  nombreEmprendimiento: string;
  filas: DatoFila[];
  bloques: string;
  botones: Array<{ texto: string; enlace: string }>;
  enlaceMis: string;
  correoInstitucional: string;
  telefonoInstitucional: string;
};

function multilinea(valor: string): string {
  return escapeHtml(valor).replace(/\r?\n/g, '<br>');
}

function saludoDe(nombre?: string | null): string {
  const limpio = nombre?.trim() || '';
  return limpio ? `Hola, ${limpio}` : 'Hola';
}

function recuadro(titulo: string, contenido: string, borde: string, fondo: string): string {
  return `<tr>
            <td class="email-content" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:16px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${fondo}" style="background-color:${fondo} !important;border-left:4px solid ${borde};">
                <tr>
                  <td bgcolor="${fondo}" style="background-color:${fondo} !important;padding:14px 16px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${borde} !important;">${escapeHtml(titulo)}</p>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#0D1B3E !important;">${contenido}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function plantilla(p: Plantilla): string {
  const { color, suave } = p.acento;
  const filas = p.filas
    .map(
      (f) =>
        `<tr><td style="padding:4px 0;font-size:14px;color:#6b7a99 !important;">${escapeHtml(f.etiqueta)}</td><td align="right" style="padding:4px 0;font-size:14px;font-weight:700;color:#0D1B3E !important;">${escapeHtml(f.valor)}</td></tr>`,
    )
    .join('');
  const botones = p.botones
    .map(
      (b) =>
        `<a href="${escapeHtml(b.enlace)}" style="display:inline-block;margin:6px 4px 0;padding:12px 22px;background-color:${color};color:#ffffff !important;font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;">${escapeHtml(b.texto)}</a>`,
    )
    .join('');
  const correo = p.correoInstitucional ? escapeHtml(p.correoInstitucional) : '';
  const telefono = p.telefonoInstitucional ? escapeHtml(p.telefonoInstitucional) : '';
  const contacto =
    correo || telefono
      ? `¿Tenés dudas? Escribinos${
          correo ? ` a <a href="mailto:${correo}" style="color:${color};font-weight:700;">${correo}</a>` : ''
        }${telefono ? `${correo ? ' o llamanos al' : ' al'} ${telefono}` : ''}.`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(p.titulo)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8 !important;color:#1e2d4e !important;font-family:Arial,Helvetica,sans-serif;color-scheme:light only;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f8" style="background-color:#f4f5f8 !important;">
    <tr>
      <td align="center" bgcolor="#f4f5f8" style="background-color:#f4f5f8 !important;padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:560px;background-color:#ffffff !important;border:1px solid #e6eaf2;">
          <tr>
            <td align="center" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:28px 20px 16px;">
              <img src="${LOGO_URL}" alt="Café UNA" width="200" style="display:block;width:200px;max-width:200px;height:auto;border:0;margin:0 auto;background-color:#ffffff;" />
            </td>
          </tr>
          <tr>
            <td bgcolor="${color}" style="background-color:${color} !important;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-content" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:32px 28px 8px;">
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#5f6b82 !important;">${escapeHtml(p.saludo)}</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.35;color:#0D1B3E !important;font-weight:700;">${escapeHtml(p.titulo)}</h1>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#3a4a6b !important;">${escapeHtml(p.mensaje)}</p>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:24px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${suave}" style="background-color:${suave} !important;border:1px solid #dfe6f0;border-top:3px solid ${color};">
                <tr>
                  <td align="center" bgcolor="${suave}" style="background-color:${suave} !important;padding:20px 24px 8px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8a96ad !important;">Tu propuesta</p>
                    <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:3px;color:${color} !important;font-family:Consolas,'Courier New',monospace;">#${escapeHtml(p.id)}</p>
                    <p style="margin:6px 0 0;font-size:17px;font-weight:700;color:#0D1B3E !important;">${escapeHtml(p.nombreEmprendimiento)}</p>
                  </td>
                </tr>
                <tr>
                  <td bgcolor="${suave}" style="background-color:${suave} !important;padding:8px 24px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e3e8f0;">${filas}</table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${p.bloques}
          ${
            botones
              ? `<tr><td align="center" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:20px 28px 0;">${botones}</td></tr>`
              : ''
          }
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff !important;padding:20px 28px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7a99 !important;">Podés ver el estado en cualquier momento en <a href="${escapeHtml(p.enlaceMis)}" style="color:${color};font-weight:700;">Mis propuestas</a>.${contacto ? ` ${contacto}` : ''}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff !important;padding:0 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #e8edf5;font-size:0;line-height:0;">&nbsp;</td></tr></table>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:0 28px 28px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${color} !important;">Café UNA</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#8a96ad !important;">Universidad Nacional, Costa Rica</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function lineasContacto(correo: string, telefono: string): string[] {
  return [
    correo ? `Correo institucional: ${correo}` : '',
    telefono ? `Teléfono institucional: ${telefono}` : '',
  ];
}

export function contenidoCorreoRecepcionPropuesta(datos: DatosCorreoRecepcionPropuesta): {
  asunto: string;
  html: string;
  texto: string;
} {
  const asunto = 'Recibimos tu propuesta';
  const titulo = '¡Gracias por tu propuesta!';
  const saludo = saludoDe(datos.nombreUsuario);
  const mensaje =
    'Recibimos la información de tu emprendimiento. Nuestro equipo la revisará y te avisaremos por este medio cuando tengamos una respuesta.';
  const correo = datos.correoInstitucional?.trim() || '';
  const telefono = datos.telefonoInstitucional?.trim() || '';

  const html = plantilla({
    acento: ACENTOS.recepcion,
    titulo,
    saludo,
    mensaje,
    id: datos.id,
    nombreEmprendimiento: datos.nombreEmprendimiento,
    filas: [
      { etiqueta: 'Fecha de envío', valor: datos.fechaEnvio },
      { etiqueta: 'Estado', valor: 'Pendiente de revisión' },
    ],
    bloques: '',
    botones: [{ texto: 'Ver mi propuesta', enlace: datos.enlaceMisPropuestas }],
    enlaceMis: datos.enlaceMisPropuestas,
    correoInstitucional: correo,
    telefonoInstitucional: telefono,
  });

  const texto = [
    saludo,
    titulo,
    mensaje,
    `Emprendimiento: ${datos.nombreEmprendimiento}`,
    `Propuesta: #${datos.id}`,
    `Fecha de envío: ${datos.fechaEnvio}`,
    'Estado: Pendiente de revisión',
    `Mis propuestas: ${datos.enlaceMisPropuestas}`,
    ...lineasContacto(correo, telefono),
    'Café UNA — Universidad Nacional, Costa Rica',
  ]
    .filter(Boolean)
    .join('\n');

  return { asunto, html, texto };
}

export function contenidoCorreoPropuesta(datos: DatosCorreoPropuesta): {
  asunto: string;
  html: string;
  texto: string;
} {
  const aprobada = datos.resultado === 'Aprobada';
  const asunto = aprobada ? '¡Tu propuesta ha sido aprobada!' : 'Estado de tu propuesta';
  const titulo = aprobada ? '¡Felicidades!' : 'Estado de tu propuesta';
  const saludo = saludoDe(datos.nombreUsuario);
  const mensaje = aprobada
    ? 'Tu propuesta fue aprobada y tu emprendimiento ya forma parte de la sección de productores de Café UNA. ¡Gracias por compartir tu historia con nosotros!'
    : 'Revisamos tu propuesta y en esta ocasión no pudimos aprobarla para su publicación.';
  const enlacePerfil = datos.enlacePerfilPublico?.trim() || '';
  const enlaceNueva = datos.enlaceNuevaPropuesta?.trim() || '';
  const motivo = datos.motivo?.trim() || '';
  const sugerencias = datos.sugerencias?.trim() || '';
  const correo = datos.correoInstitucional?.trim() || '';
  const telefono = datos.telefonoInstitucional?.trim() || '';
  const acento = aprobada ? ACENTOS.aprobada : ACENTOS.rechazada;
  const avisoCambios = `Cualquier cambio futuro en la información publicada debe solicitarse por correo al administrador${
    correo ? ` (${correo})` : ''
  }.`;

  const bloques = aprobada
    ? recuadro('Importante', escapeHtml(avisoCambios), acento.color, acento.suave)
    : [
        motivo ? recuadro('Motivo del rechazo', multilinea(motivo), acento.color, acento.suave) : '',
        sugerencias ? recuadro('Sugerencias', multilinea(sugerencias), '#5f6b82', '#f4f5f8') : '',
        recuadro(
          'Te esperamos de nuevo',
          'Te invitamos a hacer los ajustes y enviar una nueva propuesta. Con gusto la revisaremos.',
          '#286f54',
          '#f1f7f4',
        ),
      ].join('');

  const botones = aprobada
    ? enlacePerfil
      ? [{ texto: 'Ver mi perfil publicado', enlace: enlacePerfil }]
      : []
    : enlaceNueva
      ? [{ texto: 'Enviar una nueva propuesta', enlace: enlaceNueva }]
      : [];

  const html = plantilla({
    acento,
    titulo,
    saludo,
    mensaje,
    id: datos.id,
    nombreEmprendimiento: datos.nombreEmprendimiento,
    filas: [
      { etiqueta: 'Fecha de revisión', valor: datos.fechaRevision },
      { etiqueta: 'Estado', valor: datos.resultado },
    ],
    bloques,
    botones,
    enlaceMis: datos.enlaceMisPropuestas,
    correoInstitucional: correo,
    telefonoInstitucional: telefono,
  });

  const texto = [
    saludo,
    ...(aprobada
      ? [
          '¡Felicidades! Tu propuesta fue aprobada y tu emprendimiento ya forma parte de la sección de productores de Café UNA.',
          `Emprendimiento: ${datos.nombreEmprendimiento}`,
          `Propuesta: #${datos.id}`,
          `Fecha de revisión: ${datos.fechaRevision}`,
          enlacePerfil ? `Ver tu perfil publicado: ${enlacePerfil}` : '',
          avisoCambios,
        ]
      : [
          mensaje,
          `Emprendimiento: ${datos.nombreEmprendimiento}`,
          `Propuesta: #${datos.id}`,
          `Fecha de revisión: ${datos.fechaRevision}`,
          motivo ? `Motivo del rechazo: ${motivo}` : '',
          sugerencias ? `Sugerencias: ${sugerencias}` : '',
          'Te invitamos a hacer los ajustes y enviar una nueva propuesta.',
          enlaceNueva ? `Nueva propuesta: ${enlaceNueva}` : '',
        ]),
    `Mis propuestas: ${datos.enlaceMisPropuestas}`,
    ...lineasContacto(correo, telefono),
    'Café UNA — Universidad Nacional, Costa Rica',
  ]
    .filter(Boolean)
    .join('\n');

  return { asunto, html, texto };
}
