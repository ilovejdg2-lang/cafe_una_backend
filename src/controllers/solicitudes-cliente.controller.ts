import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { SolicitudesClienteService } from '../services/solicitudes-cliente.service';

@Controller('solicitudes')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class SolicitudesClienteController {
  constructor(private readonly solicitudesService: SolicitudesClienteService) {}

  /** CLI-P09: listado unificado solo del usuario del JWT. */
  @Get('mias')
  @RequierePermiso(
    'ver_solicitudes_propias',
    'hacer_solicitud_donacion',
    'ingresar_solicitud_voluntariado',
    'crear_solicitud_visitante',
  )
  listarMias(
    @Req() req: Request & { user: JwtUsuario },
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
  ) {
    return this.solicitudesService.listarPropias(req.user.userId, {
      tipo,
      estado,
    });
  }

  /** CLI-P09-T4: detalle de una solicitud propia. */
  @Get('mias/:tipo/:id')
  @RequierePermiso(
    'ver_solicitudes_propias',
    'hacer_solicitud_donacion',
    'ingresar_solicitud_voluntariado',
    'crear_solicitud_visitante',
  )
  obtenerMia(
    @Req() req: Request & { user: JwtUsuario },
    @Param('tipo') tipo: string,
    @Param('id') id: string,
  ) {
    return this.solicitudesService.obtenerPropia(req.user.userId, tipo, id);
  }
}
