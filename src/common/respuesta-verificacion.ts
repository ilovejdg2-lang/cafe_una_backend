import { BadRequestException } from '@nestjs/common';

export const MENSAJE_CORREO_NO_ENVIADO =
  'No se pudo enviar el correo. Revise que lo escribiera bien o trate de contactar a Café UNA.';

export function respuestaVerificacion(
  emailEnviado: boolean,
  mensajeError?: string,
): { message: string; emailSent: boolean; requiresVerification: true } {
  if (mensajeError) {
    throw new BadRequestException({ message: mensajeError });
  }
  return {
    message: emailEnviado
      ? 'Se envió un código de verificación al correo indicado. Revise también la carpeta de spam.'
      : MENSAJE_CORREO_NO_ENVIADO,
    emailSent: emailEnviado,
    requiresVerification: true,
  };
}
