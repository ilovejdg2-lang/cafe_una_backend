import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import {
  asegurarDirectorioDocumentos,
  DOCUMENTOS_DIR,
  DocumentosService,
} from '../services/documentos.service';

const MAX_DOCUMENTO_BYTES = 30 * 1024 * 1024; // 30 MB

const EXTENSIONES_PERMITIDAS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.zip',
  '.rar',
  '.7z',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

@Controller('documentos')
export class DocumentosController {
  constructor(
    private readonly documentosService: DocumentosService,
    private readonly jwtService: JwtService,
  ) {}

  // ==============================
  // ENDPOINTS PÚBLICOS (REP-P03)
  // ==============================

  /**
   * Listado público de documentos con filtros y buscador
   */
  @Get('publicos')
  listarPublicos(
    @Query('categoria') categoria?: string,
    @Query('subcategoria') subcategoria?: string,
    @Query('buscar') buscar?: string,
    @Query('orden') orden?: string,
  ) {
    return this.documentosService.listarPublicos({
      categoria,
      subcategoria,
      buscar,
      orden,
    });
  }

  /**
   * Listado de categorías de documentos para filtros públicos
   */
  @Get('categorias')
  listarCategorias() {
    return this.documentosService.listarCategorias();
  }

  /**
   * Solicitud pública o propuesta de archivo enviada por el usuario (REP-P03-T2)
   */
  @Post('solicitar')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          asegurarDirectorioDocumentos();
          cb(null, DOCUMENTOS_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const cleanName = file.originalname
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .substring(0, 50);
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `propuesta-${unique}-${cleanName}${ext ? '' : '.pdf'}`);
        },
      }),
      limits: { fileSize: MAX_DOCUMENTO_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!EXTENSIONES_PERMITIDAS.has(ext)) {
          return cb(
            new BadRequestException(
              `Tipo de archivo no permitido (${ext}). Se aceptan: PDF, Word, Excel, PowerPoint, texto, imágenes y comprimidos.`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  solicitarAcceso(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: {
      documentoId?: string;
      documentoTitulo?: string;
      nombre: string;
      correo: string;
      institucion?: string;
      motivo?: string;
      categoria?: string;
    },
  ) {
    return this.documentosService.solicitarAcceso(body, file);
  }

  /**
   * Descarga de documento mediante token temporal de solicitud aprobada
   */
  @Get('descarga-token/:token')
  async descargarPorToken(
    @Param('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const { stream, nombreOriginal, mimeType } =
      await this.documentosService.descargarPorToken(token, ip);

    const safeFilename = encodeURIComponent(nombreOriginal);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
    });
    return stream;
  }

  /**
   * Visualización directa en línea de un documento (inline)
   */
  @Get(':id/visualizar')
  async visualizarDocumento(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('authorization') authHeader: string | undefined,
    @Query('token') queryToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    let usuario: any = undefined;
    const token =
      authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : queryToken;

    if (token) {
      try {
        usuario = await this.jwtService.verifyAsync(token);
      } catch {
        usuario = undefined;
      }
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const { stream, nombreOriginal, mimeType } =
      await this.documentosService.descargar(id, usuario, ip);

    const safeFilename = encodeURIComponent(nombreOriginal);
    res.set({
      'Content-Type': mimeType || 'application/pdf',
      'Content-Disposition': `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
    });
    return stream;
  }

  /**
   * Descarga de documento (REP-P02-T3)
   * Si el documento es público, no requiere login.
   * Si es privado, requiere que el usuario tenga permisos.
   */
  @Get(':id/descargar')
  async descargarDocumento(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('authorization') authHeader: string | undefined,
    @Query('token') queryToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // Extraer usuario si viene token Bearer o queryToken
    let usuario: any = undefined;
    const token =
      authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : queryToken;

    if (token) {
      try {
        usuario = await this.jwtService.verifyAsync(token);
      } catch {
        usuario = undefined;
      }
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const { stream, nombreOriginal, mimeType } =
      await this.documentosService.descargar(id, usuario, ip);

    const safeFilename = encodeURIComponent(nombreOriginal);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
    });
    return stream;
  }

  // ==============================
  // ENDPOINTS ADMINISTRATIVOS (REP-P01, REP-P02, REP-P04)
  // ==============================

  /**
   * Listado administrativo completo de documentos
   */
  @Get('admin/listado')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ver_documentacion_privada', 'crear_documentacion')
  listarAdmin(
    @Query('categoria') categoria?: string,
    @Query('subcategoria') subcategoria?: string,
    @Query('buscar') buscar?: string,
    @Query('esPrivado') esPrivado?: string,
    @Query('activo') activo?: string,
  ) {
    return this.documentosService.listarAdmin({
      categoria,
      subcategoria,
      buscar,
      esPrivado,
      activo,
    });
  }

  /**
   * Métricas y registro de descargas (REP-P02-T3)
   */
  @Get('admin/estadisticas')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ver_documentacion_privada', 'crear_documentacion')
  obtenerEstadisticas() {
    return this.documentosService.obtenerEstadisticas();
  }

  /**
   * Exportar catálogo de documentos en CSV (REP-P04)
   */
  @Get('admin/exportar')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ver_documentacion_privada', 'crear_documentacion')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="catalogo-documentos-cafe-una.csv"')
  async exportarCsv() {
    return this.documentosService.exportarCatalogoCsv();
  }

  /**
   * Subida de documento con archivo y metadatos (REP-P02-T1)
   */
  @Post('admin')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('crear_documentacion')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          asegurarDirectorioDocumentos();
          cb(null, DOCUMENTOS_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const cleanName = file.originalname
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .substring(0, 50);
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `doc-${unique}-${cleanName}${ext ? '' : '.pdf'}`);
        },
      }),
      limits: { fileSize: MAX_DOCUMENTO_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!EXTENSIONES_PERMITIDAS.has(ext)) {
          return cb(
            new BadRequestException(
              `Tipo de archivo no permitido (${ext}). Se aceptan: PDF, Word, Excel, PowerPoint, texto, imágenes y comprimidos.`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  crearDocumento(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      titulo: string;
      descripcion?: string;
      categoria: string;
      subcategoria?: string;
      esPrivado?: string;
      autor?: string;
      version?: string;
      palabrasClave?: string;
      activo?: string;
    },
  ) {
    return this.documentosService.crear(file, body);
  }

  /**
   * Actualización de metadatos o reemplazo de archivo (REP-P02-T2)
   */
  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_documentacion')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          asegurarDirectorioDocumentos();
          cb(null, DOCUMENTOS_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const cleanName = file.originalname
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .substring(0, 50);
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `doc-${unique}-${cleanName}${ext ? '' : '.pdf'}`);
        },
      }),
      limits: { fileSize: MAX_DOCUMENTO_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!EXTENSIONES_PERMITIDAS.has(ext)) {
          return cb(
            new BadRequestException(
              `Tipo de archivo no permitido (${ext}).`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  actualizarDocumento(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: {
      titulo?: string;
      descripcion?: string;
      categoria?: string;
      subcategoria?: string;
      esPrivado?: string;
      autor?: string;
      version?: string;
      palabrasClave?: string;
      activo?: string;
    },
  ) {
    return this.documentosService.actualizar(id, body, file);
  }

  /**
   * Alternar estado Activo / Inactivo
   */
  @Patch('admin/:id/estado')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_documentacion', 'inactivar_documentacion')
  cambiarEstado(
    @Param('id') id: string,
    @Body('activo') activo: boolean,
  ) {
    return this.documentosService.cambiarEstado(id, activo);
  }

  /**
   * Eliminar documento (REP-P02-T2)
   */
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_documentacion')
  eliminarDocumento(@Param('id') id: string) {
    return this.documentosService.eliminar(id);
  }

  /**
   * Listar solicitudes de documentos privados (REP-P03-T2)
   */
  @Get('admin/solicitudes')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_documentacion')
  listarSolicitudes(@Query('estado') estado?: string) {
    return this.documentosService.listarSolicitudes(estado);
  }

  /**
   * Atender solicitud (Aprobar o Rechazar) (REP-P03-T2)
   */
  @Patch('admin/solicitudes/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_documentacion')
  atenderSolicitud(
    @Param('id') id: string,
    @Req() req: any,
    @Body()
    body: {
      estado: 'Aprobada' | 'Rechazada';
      respuestaAdmin?: string;
    },
  ) {
    const atendidoPor = req.user?.username || req.user?.name || req.user?.email || 'Administrador';
    return this.documentosService.atenderSolicitud(id, {
      ...body,
      atendidoPor,
    });
  }

  /**
   * Descarga o previsualiza el archivo aportado por un usuario en una solicitud
   */
  @Get('admin/solicitudes/:id/archivo')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_documentacion', 'ver_documentacion_privada')
  async descargarArchivoSolicitud(
    @Param('id') id: string,
    @Query('inline') inline: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, nombreOriginal, mimeType } =
      await this.documentosService.descargarArchivoSolicitud(id);

    const safeFilename = encodeURIComponent(nombreOriginal);
    const disposition = inline === 'true' ? 'inline' : 'attachment';
    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
    });
    return stream;
  }
}
