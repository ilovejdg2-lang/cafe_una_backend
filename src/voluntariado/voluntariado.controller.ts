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
} from '@nestjs/common';
import { esSuperAdmin } from '../common/usuario-validacion';
import { VoluntariadoService } from './voluntariado.service';

@Controller('voluntariado/solicitudes')
export class VoluntariadoController {
  constructor(private readonly voluntariadoService: VoluntariadoService) {}

  @Get()
  obtenerSolicitudes() {
    return this.voluntariadoService.obtenerSolicitudes();
  }

  @Get('usuario/:userId')
  obtenerSolicitudesDeUsuario(@Param('userId') userId: string) {
    return this.voluntariadoService.obtenerSolicitudesDeUsuario(userId);
  }

  @Post()
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
  async actualizarSolicitud(
    @Param('id') id: string,
    @Body() cambios: Record<string, unknown>,
  ) {
    const actualizada = await this.voluntariadoService.actualizar(id, cambios as never);
    if (!actualizada) throw new NotFoundException();
    return actualizada;
  }

  @Delete(':id')
  async eliminarSolicitud(
    @Param('id') id: string,
    @Body() request?: { ActorRoles?: string[] },
  ) {
    if (!esSuperAdmin(request?.ActorRoles)) {
      throw new BadRequestException({
        message: 'Solo SuperAdmin puede eliminar solicitudes de voluntariado.',
      });
    }
    const deleted = await this.voluntariadoService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
