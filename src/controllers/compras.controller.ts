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
import { ComprasService } from '../services/compras.service';

const COMPROBANTES_DIR = join(process.cwd(), 'uploads', 'compras');
const MAX_COMPROBANTE_BYTES = 10 * 1024 * 1024;
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTS_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function asegurarDirectorioComprobantes(): void {
  if (!existsSync(COMPROBANTES_DIR)) {
    mkdirSync(COMPROBANTES_DIR, { recursive: true });
  }
}

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
          asegurarDirectorioComprobantes();
          cb(null, COMPROBANTES_DIR);
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

  @Get('mias')
  @RequierePermiso('ver_historial_compras_propio')
  listarMias(
    @Req() req: Request & { user: JwtUsuario },
    @Query() query: Record<string, string | undefined>,
  ) {
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
    const root = resolve(COMPROBANTES_DIR);
    const absolute = resolve(root, filename);
    const rel = relative(root, absolute);
    if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new BadRequestException('Ruta de comprobante inválida.');
    }
    if (!existsSync(absolute)) {
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
