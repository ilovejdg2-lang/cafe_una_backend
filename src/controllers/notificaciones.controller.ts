import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { NotificacionesPropuestasService } from '../services/notificaciones-propuestas.service';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesPropuestasService) {}

  @Get()
  @RequierePermiso('ver_panel_usuario_propio', 'ver_solicitudes_propias', 'ingresar_propuesta_productor')
  listar(@Req() req: Request & { user: { userId: number } }) {
    return this.notificaciones.listarPropias(req.user.userId);
  }

  @Post(':id/leida')
  @RequierePermiso('ver_panel_usuario_propio', 'ver_solicitudes_propias', 'ingresar_propuesta_productor')
  marcar(
    @Req() req: Request & { user: { userId: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificaciones.marcarLeida(req.user.userId, id);
  }
}
