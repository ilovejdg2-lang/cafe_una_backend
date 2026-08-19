import { SetMetadata } from '@nestjs/common';

export const PERMISOS_KEY = 'permisos';

export const RequierePermiso = (...codigos: string[]) =>
  SetMetadata(PERMISOS_KEY, codigos);
