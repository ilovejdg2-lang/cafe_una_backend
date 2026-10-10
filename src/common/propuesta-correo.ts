import { escapeHtml } from './propuesta-productor.util';

export type DatosCorreoPropuesta = {
  nombreEmprendimiento: string;
  id: string;
  resultado: 'Aprobada' | 'Rechazada';
  fechaRevision: string;
  enlaceMisPropuestas: string;
  motivo?: string | null;
  correoInstitucional?: string | null;
  telefonoInstitucional?: string | null;
};

export function contenidoCorreoPropuesta(datos: DatosCorreoPropuesta): {
  asunto: string;
  html: string;
  texto: string;
} {
  const aprobada = datos.resultado === 'Aprobada';
  const asunto = aprobada
    ? 'Tu propuesta de productor fue aprobada - Café UNA'
    : 'Resultado de tu propuesta de productor - Café UNA';
  const nombre = escapeHtml(datos.nombreEmprendimiento);
  const id = escapeHtml(datos.id);
  const fecha = escapeHtml(datos.fechaRevision);
  const enlace = escapeHtml(datos.enlaceMisPropuestas);
  const motivo = datos.motivo?.trim() ? escapeHtml(datos.motivo.trim()) : '';
  const correo = datos.correoInstitucional?.trim()
    ? escapeHtml(datos.correoInstitucional.trim())
    : '';
  const telefono = datos.telefonoInstitucional?.trim()
    ? escapeHtml(datos.telefonoInstitucional.trim())
    : '';
  const contacto =
    correo || telefono
      ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#3a4a6b;">Contacto institucional:${
          correo ? `<br>Correo: <a href="mailto:${correo}">${correo}</a>` : ''
        }${telefono ? `<br>Teléfono: ${telefono}` : ''}</p>`
      : '';
  const bloqueMotivo = motivo
    ? `<p style="margin:16px 0 0;padding:12px 14px;background:#fdf2f4;border-left:4px solid #C41E3A;color:#0D1B3E;"><strong>Motivo del rechazo:</strong><br>${motivo}</p>`
    : '';
  const mensaje = aprobada
    ? 'Tu propuesta fue aprobada para su publicación en el sitio de Café UNA.'
    : 'Tu propuesta no fue aprobada en esta revisión.';

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f4f5f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6eaf2;padding:28px;">
        <tr><td>
          <p style="margin:0 0 8px;color:#5f6b82;">Café UNA</p>
          <h1 style="margin:0 0 12px;font-size:22px;color:#0D1B3E;">Resultado de tu propuesta</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#3a4a6b;">${mensaje}</p>
          <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#0D1B3E;">
            <strong>Emprendimiento:</strong> ${nombre}<br>
            <strong>Propuesta:</strong> ${id}<br>
            <strong>Resultado:</strong> ${escapeHtml(datos.resultado)}<br>
            <strong>Fecha de revisión:</strong> ${fecha}
          </p>
          ${bloqueMotivo}
          <p style="margin:20px 0 0;font-size:15px;line-height:1.6;">
            <a href="${enlace}" style="color:#286f54;font-weight:700;">Consultar Mis propuestas</a>
          </p>
          ${contacto}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const texto = [
    mensaje,
    `Emprendimiento: ${datos.nombreEmprendimiento}`,
    `Propuesta: ${datos.id}`,
    `Resultado: ${datos.resultado}`,
    `Fecha de revisión: ${datos.fechaRevision}`,
    motivo ? `Motivo del rechazo: ${datos.motivo?.trim()}` : '',
    `Mis propuestas: ${datos.enlaceMisPropuestas}`,
    correo ? `Correo institucional: ${datos.correoInstitucional?.trim()}` : '',
    telefono ? `Teléfono institucional: ${datos.telefonoInstitucional?.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { asunto, html, texto };
}
