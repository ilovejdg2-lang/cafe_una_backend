import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { memoryStorage } from 'multer';

import { IMAGEN_MAX_BYTES } from '../common/propuesta-productor.util';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { PropuestasProductoresService } from '../services/propuestas-productores.service';

type RequestUsuario = Request & { user: { userId: number } };

@Controller('propuestas-productores')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class PropuestasProductoresController {
  constructor(private readonly propuestas: PropuestasProductoresService) {}

  @Post()
  @RequierePermiso('ingresar_propuesta_productor')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: memoryStorage(),
      limits: { fileSize: IMAGEN_MAX_BYTES },
    }),
  )
  crear(
    @Req() req: RequestUsuario,
    @Body() body: Record<string, unknown>,
    @UploadedFile()
    archivo?: { buffer: Buffer; size?: number; mimetype?: string; originalname?: string },
  ) {
    return this.propuestas.crear(req.user.userId, body, archivo);
  }

  @Get('mias')
  @RequierePermiso('ingresar_propuesta_productor', 'ver_solicitudes_propias')
  listarMias(@Req() req: RequestUsuario) {
    return this.propuestas.listarMias(req.user.userId);
  }

  @Get('mias/:id')
  @RequierePermiso('ingresar_propuesta_productor', 'ver_solicitudes_propias')
  obtenerMia(@Req() req: RequestUsuario, @Param('id') id: string) {
    return this.propuestas.obtenerMia(req.user.userId, id);
  }

  @Get()
  @RequierePermiso('administrar_solicitudes_productores')
  listarAdmin(
    @Query('q') q?: string,
    @Query('estado') estado?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.propuestas.listarAdmin({ q, estado, desde, hasta, page, pageSize });
  }

  @Get(':id')
  @RequierePermiso('administrar_solicitudes_productores')
  obtenerAdmin(@Param('id') id: string) {
    return this.propuestas.obtenerAdmin(id);
  }

  @Put(':id')
  @RequierePermiso('administrar_solicitudes_productores')
  actualizar(
    @Req() req: RequestUsuario,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.propuestas.actualizarAdmin(id, req.user.userId, body ?? {});
  }

  @Patch(':id/estado')
  @RequierePermiso('administrar_solicitudes_productores')
  cambiarEstado(
    @Req() req: RequestUsuario,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.propuestas.cambiarEstadoRevision(
      id,
      req.user.userId,
      body?.estado ?? body?.Estado,
      body?.comentario ?? body?.Comentario,
    );
  }

  @Put(':id/nota-interna')
  @RequierePermiso('administrar_solicitudes_productores')
  guardarNotaInterna(
    @Req() req: RequestUsuario,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.propuestas.guardarNotaInterna(
      id,
      req.user.userId,
      body?.nota ?? body?.Nota ?? body?.notaInterna ?? body?.NotaInterna,
    );
  }

  @Post(':id/aprobar')
  @RequierePermiso('administrar_solicitudes_productores')
  aprobar(
    @Req() req: RequestUsuario,
    @Param('id') id: string,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.propuestas.aprobar(
      id,
      req.user.userId,
      body?.comentario ?? body?.Comentario,
    );
  }

  @Post(':id/rechazar')
  @RequierePermiso('administrar_solicitudes_productores')
  rechazar(
    @Req() req: RequestUsuario,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const motivo = body.motivo ?? body.Motivo;
    if (motivo == null || String(motivo).trim() === '') {
      throw new BadRequestException('El motivo del rechazo es obligatorio.');
    }
    return this.propuestas.rechazar(
      id,
      req.user.userId,
      motivo,
      body.sugerencias ?? body.Sugerencias,
      body.comentario ?? body.Comentario,
    );
  }
}
