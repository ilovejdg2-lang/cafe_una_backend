import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join, relative, resolve, sep } from 'path';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { SolicitudesCompraService } from '../services/solicitudes-compra.service';

const PROFORMAS_DIR = join(process.cwd(), 'uploads', 'proformas');
const MAX_PROFORMA_BYTES = 5 * 1024 * 1024;

function asegurarDirectorioProformas(): void {
  if (!existsSync(PROFORMAS_DIR)) {
    mkdirSync(PROFORMAS_DIR, { recursive: true });
  }
}

function esPdf(file: {
  mimetype?: string;
  originalname?: string;
}): boolean {
  const mime = (file.mimetype ?? '').toLowerCase();
  const ext = extname(file.originalname ?? '').toLowerCase();
  return mime === 'application/pdf' || ext === '.pdf';
}

@Controller('solicitudes-compra')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class SolicitudesCompraController {
  constructor(
    private readonly solicitudesCompraService: SolicitudesCompraService,
  ) {}

  @Get()
  @RequierePermiso('ver_inventario')
  listar(
    @Query('estado') estado?: string,
    @Query('proveedorId') proveedorId?: string,
  ) {
    return this.solicitudesCompraService.listar({ estado, proveedorId });
  }

  @Get(':id/proforma')
  @RequierePermiso('ver_inventario')
  async descargarProforma(@Param('id') id: string): Promise<StreamableFile> {
    const filename = await this.solicitudesCompraService.obtenerNombreArchivoProforma(
      id,
    );
    if (!filename) {
      throw new NotFoundException('Esta solicitud no tiene proforma adjunta.');
    }

    const root = resolve(PROFORMAS_DIR);
    const absolute = resolve(root, filename);
    const rel = relative(root, absolute);
    if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new BadRequestException('Ruta de proforma inválida.');
    }
    if (!existsSync(absolute)) {
      throw new NotFoundException('No se encontró el archivo de la proforma.');
    }

    const stream = createReadStream(absolute);
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get(':id')
  @RequierePermiso('ver_inventario')
  obtener(@Param('id') id: string) {
    return this.solicitudesCompraService.obtenerPorId(id);
  }

  @Post()
  @RequierePermiso('ajustar_stock_ubicaciones')
  @UseInterceptors(
    FileInterceptor('proforma', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          asegurarDirectorioProformas();
          cb(null, PROFORMAS_DIR);
        },
        filename: (_req, file, cb) => {
          const safeExt = esPdf(file) ? '.pdf' : extname(file.originalname);
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `proforma-${unique}${safeExt || '.pdf'}`);
        },
      }),
      limits: { fileSize: MAX_PROFORMA_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!esPdf(file)) {
          cb(
            new BadRequestException(
              'La proforma debe ser un archivo PDF.',
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  crear(
    @Body() body: Record<string, unknown>,
    @UploadedFile()
    file:
      | {
          filename: string;
          mimetype?: string;
          originalname?: string;
          size?: number;
        }
      | undefined,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    // Solo el nombre del archivo; el download va por GET autenticado.
    const urlProforma = file ? file.filename : null;
    return this.solicitudesCompraService.crear(
      body ?? {},
      req.user?.userId ?? null,
      urlProforma,
    );
  }

  @Patch(':id/estado')
  @RequierePermiso('ajustar_stock_ubicaciones')
  cambiarEstado(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.solicitudesCompraService.cambiarEstado(
      id,
      body ?? {},
      req.user?.userId ?? null,
    );
  }
}
