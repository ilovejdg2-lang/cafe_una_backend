import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
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
import { createReadStream, writeFileSync } from 'fs';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import {
  asegurarDirectorioUpload,
  nombreArchivoSeguro,
  resolverArchivoUpload,
} from '../common/upload-paths';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { ComprasService } from '../services/compras.service';
import { SupabaseStorageService } from '../services/supabase-storage.service';

const COMPROBANTES_SUBDIR = 'compras';
/** Bucket privado: los comprobantes contienen datos de pago y nunca son públicos. */
const COMPROBANTES_BUCKET =
  process.env.SUPABASE_COMPROBANTES_BUCKET || 'comprobantes';
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

function nombreComprobante(originalname: string): string {
  const ext = extname(originalname ?? '').toLowerCase();
  const extFinal = EXTS_IMAGEN.has(ext) ? ext : '.jpg';
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `comprobante-${unique}${extFinal}`;
}

@Controller('compras')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ComprasController {
  private readonly logger = new Logger(ComprasController.name);

  constructor(
    private readonly comprasService: ComprasService,
    private readonly storage: SupabaseStorageService,
  ) {}

  @Post()
  @RequierePermiso('comprar_productos', 'registrar_ventas')
  @UseInterceptors(
    FileInterceptor('comprobante', {
      storage: memoryStorage(),
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
  async registrar(
    @Body() body: Record<string, unknown>,
    @UploadedFile()
    file:
      | {
          originalname: string;
          mimetype?: string;
          buffer: Buffer;
        }
      | undefined,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    const datos = {
      ...((req.body as Record<string, unknown>) ?? {}),
      ...(body ?? {}),
    };
    const userId = req.user.userId ?? null;

    if (!file) {
      return this.comprasService.registrar(
        { ...datos, comprobanteArchivo: undefined },
        userId,
      );
    }

    const nombre = nombreComprobante(file.originalname);
    const enBucket = this.storage.estaHabilitado();

    if (enBucket) {
      // El comprobante debe quedar persistido antes de crear la compra.
      const subido = await this.storage.subirArchivo(
        nombre,
        file.buffer,
        file.mimetype || mimePorNombre(nombre),
        COMPROBANTES_BUCKET,
      );
      if (!subido) {
        throw new InternalServerErrorException(
          'No se pudo guardar el comprobante. Intenta nuevamente.',
        );
      }
    } else {
      writeFileSync(
        join(asegurarDirectorioUpload(COMPROBANTES_SUBDIR), nombre),
        file.buffer,
      );
    }

    try {
      return await this.comprasService.registrar(
        { ...datos, comprobanteArchivo: nombre },
        userId,
      );
    } catch (err) {
      if (enBucket) {
        try {
          await this.storage.eliminarArchivo(nombre, COMPROBANTES_BUCKET);
        } catch (cleanupErr) {
          this.logger.error(
            `No se pudo eliminar el comprobante huérfano "${nombre}": ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
          );
        }
      }
      throw err;
    }
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
      return this.comprasService.listarParaActor(queryFinal, {
        userId: req.user.userId,
        roles: req.user.roles ?? [],
      });
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
    const safe = nombreArchivoSeguro(filename);
    const type = mimePorNombre(safe);
    const disposition = `inline; filename="${safe}"`;
    const absolute = safe
      ? resolverArchivoUpload(COMPROBANTES_SUBDIR, safe)
      : null;
    if (absolute) {
      return new StreamableFile(createReadStream(absolute), {
        type,
        disposition,
      });
    }
    const remoto = safe
      ? await this.storage.descargarBuffer(safe, COMPROBANTES_BUCKET)
      : null;
    if (!remoto) {
      throw new NotFoundException('No se encontró el archivo del comprobante.');
    }
    return new StreamableFile(remoto, { type, disposition });
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
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.comprasService.cambiarEstado(
      id,
      body?.estado ?? body?.Estado,
      {
        userId: req.user?.userId ?? null,
        roles: req.user?.roles ?? [],
      },
    );
  }
}
