import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join, relative, resolve, sep } from 'path';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';

const IMAGENES_DIR = join(process.cwd(), 'uploads', 'puntos-venta');
const MAX_IMAGEN_BYTES = 10 * 1024 * 1024;
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTS_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function asegurarDirectorioImagenes(): void {
  if (!existsSync(IMAGENES_DIR)) {
    mkdirSync(IMAGENES_DIR, { recursive: true });
  }
}

function esImagen(file: { mimetype?: string; originalname?: string }): boolean {
  const mime = (file.mimetype ?? '').toLowerCase();
  const ext = extname(file.originalname ?? '').toLowerCase();
  return TIPOS_IMAGEN.has(mime) || EXTS_IMAGEN.has(ext);
}

function mimePorNombre(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

@Controller('inventario/ubicaciones/imagenes')
export class UbicacionImagenesController {
  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ajustar_stock_ubicaciones')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          asegurarDirectorioImagenes();
          cb(null, IMAGENES_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const segura = EXTS_IMAGEN.has(ext) ? ext : '.jpg';
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `punto-${unique}${segura}`);
        },
      }),
      limits: { fileSize: MAX_IMAGEN_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!esImagen(file)) {
          cb(
            new BadRequestException('La imagen debe ser JPG, PNG o WEBP.') as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  subirImagen(@UploadedFile() file: { filename: string } | undefined) {
    if (!file?.filename) {
      throw new BadRequestException('Debés adjuntar una imagen.');
    }
    return { url: `/api/inventario/ubicaciones/imagenes/${file.filename}` };
  }

  @Get(':filename')
  servirImagen(@Param('filename') filename: string) {
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
      throw new BadRequestException('Nombre de imagen inválido.');
    }
    const root = resolve(IMAGENES_DIR);
    const absolute = resolve(root, filename);
    const rel = relative(root, absolute);
    if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new BadRequestException('Ruta de imagen inválida.');
    }
    if (!existsSync(absolute)) {
      throw new NotFoundException('No se encontró la imagen del punto de venta.');
    }
    return new StreamableFile(createReadStream(absolute), {
      type: mimePorNombre(filename),
      disposition: `inline; filename="${filename}"`,
    });
  }
}
