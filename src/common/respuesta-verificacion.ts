import { BadRequestException } from '@nestjs/common';

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
      : 'Se generó el código, pero no se pudo enviar el correo. Intente de nuevo en unos minutos.',
    emailSent: emailEnviado,
    requiresVerification: true,
  };
}
