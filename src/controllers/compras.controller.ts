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
import { createReadStream } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import {
  asegurarDirectorioUpload,
  resolverArchivoUpload,
} from '../common/upload-paths';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { ComprasService } from '../services/compras.service';

const COMPROBANTES_SUBDIR = 'compras';
const MAX_COMPROBANTE_BYTES = 10 * 1024 * 1024;
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTS_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function esImagenComprobante(file: {
  mimetype?: string;
  originalname?: string;
}): boolean {
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

@Controller('compras')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Post()
  @RequierePermiso('comprar_productos', 'registrar_ventas')
  @UseInterceptors(
    FileInterceptor('comprobante', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, asegurarDirectorioUpload(COMPROBANTES_SUBDIR));
        },
        filename: (_req, file, cb) => {
          const ext = EXTS_IMAGEN.has(extname(file.originalname).toLowerCase())
            ? extname(file.originalname).toLowerCase()
            : '.jpg';
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `comprobante-${unique}${ext}`);
        },
      }),
      limits: { fileSize: MAX_COMPROBANTE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!esImagenComprobante(file)) {
          cb(
            new BadRequestException(
              'El comprobante debe ser una imagen JPG, PNG o WEBP.',
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  registrar(
    @Body() body: Record<string, unknown>,
    @UploadedFile()
    file:
      | {
          filename: string;
        }
      | undefined,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.comprasService.registrar(
      {
        ...((req.body as Record<string, unknown>) ?? {}),
        ...(body ?? {}),
        comprobanteArchivo: file?.filename,
      },
      req.user.userId ?? null,
    );
  }

  /** CLI-P03: historial propio — Pendiente | Aceptado | Entregado | Rechazado. */
  @Get('mias')
  @RequierePermiso('ver_historial_compras_propio')
  listarMias(
    @Req() req: Request & { user: JwtUsuario },
    @Query() query: Record<string, string | undefined>,
  ) {
    if (req.user?.userId == null) {
      throw new BadRequestException(
        'Debés iniciar sesión para ver tus compras.',
      );
    }
    return this.comprasService.listarPropias(req.user.userId, query);
  }

  @Get()
  @RequierePermiso('ver_historial_compras_clientes', 'ver_ventas')
  listarAdmin(
    @Query() query: Record<string, string | undefined>,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    const roles = (req.user?.roles ?? []).map((r) => String(r).toLowerCase());
    const esAdmin = roles.includes('superadmin') || roles.includes('admin');
    const queryFinal = { ...query };
    if (!esAdmin && req.user?.userId) {
      queryFinal.usuarioId = String(req.user.userId);
    }
    return this.comprasService.listar(queryFinal);
  }

  @Get(':id/comprobante')
  @RequierePermiso(
    'ver_historial_compras_propio',
    'ver_historial_compras_clientes',
    'ver_ventas',
  )
  async descargarComprobante(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUsuario },
  ): Promise<StreamableFile> {
    const filename = await this.comprasService.obtenerNombreArchivoComprobante(
      id,
      req.user.userId ?? null,
      req.user.roles ?? [],
    );
    const absolute = resolverArchivoUpload(COMPROBANTES_SUBDIR, filename);
    if (!absolute) {
      throw new NotFoundException('No se encontró el archivo del comprobante.');
    }
    return new StreamableFile(createReadStream(absolute), {
      type: mimePorNombre(filename),
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get(':id')
  @RequierePermiso(
    'ver_historial_compras_propio',
    'ver_historial_compras_clientes',
    'ver_ventas',
  )
  obtenerDetalle(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.comprasService.obtenerDetalleAutorizado(
      id,
      req.user.userId ?? null,
      req.user.roles ?? [],
    );
  }

  @Patch(':id/estado')
  @RequierePermiso('actualizar_ventas', 'registrar_ventas')
  cambiarEstado(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.comprasService.cambiarEstado(
      id,
      body?.estado ?? body?.Estado,
    );
  }
}
