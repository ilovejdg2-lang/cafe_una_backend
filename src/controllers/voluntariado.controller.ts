import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { VoluntariadoService } from '../services/voluntariado.service';

@Controller('voluntariado/solicitudes')
export class VoluntariadoController {
  constructor(private readonly voluntariadoService: VoluntariadoService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ver_solicitudes_voluntariado')
  obtenerSolicitudes() {
    return this.voluntariadoService.obtenerSolicitudes();
  }

  @Get('usuario/:userId')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ingresar_solicitud_voluntariado', 'ver_solicitudes_voluntariado')
  obtenerSolicitudesDeUsuario(@Param('userId') userId: string) {
    return this.voluntariadoService.obtenerSolicitudesDeUsuario(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ingresar_solicitud_voluntariado')
  async crearSolicitud(@Body() request: Record<string, unknown>) {
    try {
      return await this.voluntariadoService.crear(request as never);
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'administrar_solicitudes_voluntariado',
    'actualizar_solicitud_voluntariado',
  )
  async actualizarSolicitud(
    @Param('id') id: string,
    @Body() cambios: Record<string, unknown>,
  ) {
    const actualizada = await this.voluntariadoService.actualizar(id, cambios as never);
    if (!actualizada) throw new NotFoundException();
    return actualizada;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_voluntariado')
  async eliminarSolicitud(@Param('id') id: string) {
    const deleted = await this.voluntariadoService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
