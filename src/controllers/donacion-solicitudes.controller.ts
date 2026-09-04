import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { DonacionSolicitudesService } from '../services/donacion-solicitudes.service';

@Controller('v1/donaciones/solicitudes')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class DonacionSolicitudesController {
  constructor(
    private readonly solicitudesService: DonacionSolicitudesService,
  ) {}

  @Get()
  @RequierePermiso(
    'ver_solicitudes_donacion',
    'administrar_solicitudes_donaciones',
  )
  listarAdmin() {
    return this.solicitudesService.listarAdmin();
  }

  @Get('mias')
  @RequierePermiso('hacer_solicitud_donacion')
  listarMias(@Req() req: Request & { user: JwtUsuario }) {
    return this.solicitudesService.listarPropias(req.user.userId);
  }

  @Post()
  @RequierePermiso('hacer_solicitud_donacion')
  crear(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.solicitudesService.crear(body ?? {}, req.user.userId);
  }
}
