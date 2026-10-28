import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { SolicitudesSalidaInventarioService } from '../services/solicitudes-salida-inventario.service';
import type { CrearSolicitudSalidaInput } from '../services/solicitudes-salida-inventario.service';

@Controller('inventario/salidas-solicitudes')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class SolicitudesSalidaInventarioController {
  constructor(
    private readonly solicitudes: SolicitudesSalidaInventarioService,
  ) {}

  @Post()
  @RequierePermiso('ajustar_stock_ubicaciones')
  crear(
    @Body() body: CrearSolicitudSalidaInput,
    @Req() request: Request & { user: JwtUsuario },
  ) {
    return this.solicitudes.crearSolicitud(body ?? {}, request.user.userId);
  }

  @Get()
  @RequierePermiso('ver_inventario', 'ajustar_stock_ubicaciones')
  listar(
    @Query('estado') estado: string,
    @Req() request: Request & { user: JwtUsuario },
  ) {
    return this.solicitudes.listarSolicitudes(
      request.user.userId,
      request.user.roles,
      estado,
    );
  }

  @Get(':id')
  @RequierePermiso('ver_inventario', 'ajustar_stock_ubicaciones')
  obtener(
    @Param('id') id: string,
    @Req() request: Request & { user: JwtUsuario },
  ) {
    return this.solicitudes.obtenerSolicitud(
      id,
      request.user.userId,
      request.user.roles,
    );
  }

  @Post(':id/aprobar')
  @RequierePermiso('ajustar_stock_ubicaciones')
  aprobar(
    @Param('id') id: string,
    @Body() body: { comentario?: string },
    @Req() request: Request & { user: JwtUsuario },
  ) {
    return this.solicitudes.aprobarSolicitud(
      id,
      request.user.userId,
      request.user.roles,
      body?.comentario,
    );
  }

  @Post(':id/rechazar')
  @RequierePermiso('ajustar_stock_ubicaciones')
  rechazar(
    @Param('id') id: string,
    @Body() body: { comentario?: string },
    @Req() request: Request & { user: JwtUsuario },
  ) {
    return this.solicitudes.rechazarSolicitud(
      id,
      request.user.userId,
      request.user.roles,
      body?.comentario ?? '',
    );
  }

  @Post(':id/cancelar')
  @RequierePermiso('ajustar_stock_ubicaciones')
  cancelar(
    @Param('id') id: string,
    @Body() body: { comentario?: string },
    @Req() request: Request & { user: JwtUsuario },
  ) {
    return this.solicitudes.cancelarSolicitud(
      id,
      request.user.userId,
      request.user.roles,
      body?.comentario ?? '',
    );
  }
}
