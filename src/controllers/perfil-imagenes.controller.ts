import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import {
  MAX_PROFILE_IMAGE_BYTES,
  PerfilImagenStorage,
} from '../services/perfil-imagen.storage';

@Injectable()
export class PerfilImagenesPrivacyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return true;
  }
}

@Controller('perfil/imagenes')
@UseGuards(PerfilImagenesPrivacyGuard, JwtAuthGuard, PermisosGuard)
export class PerfilImagenesController {
  constructor(private readonly storage: PerfilImagenStorage) {}

  @Post()
  @RequierePermiso('actualizar_perfil_propio')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PROFILE_IMAGE_BYTES, files: 1, fields: 0 },
    }),
  )
  async subirImagen(@UploadedFile() file?: { buffer: Buffer }) {
    const name = await this.storage.guardar(file?.buffer || Buffer.alloc(0));
    return { url: `/api/perfil/imagenes/${name}` };
  }

  @Get(':nombre')
  @RequierePermiso('ver_perfil_propio')
  async servirImagen(@Param('nombre') name: string) {
    return new StreamableFile(await this.storage.leer(name), {
      type: 'image/webp',
    });
  }
}
