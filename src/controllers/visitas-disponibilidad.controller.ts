import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { VisitasDisponibilidadService } from '../services/visitas-disponibilidad.service';

@Controller('visitas/disponibilidad')
export class VisitasDisponibilidadController {
  constructor(private readonly service: VisitasDisponibilidadService) {}

  @Get()
  listarPublicas(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.listarPublicas({ desde, hasta });
  }

  @Get('franjas')
  obtenerFranjas(@Query('fecha') fecha: string) {
    return this.service.obtenerFranjasPorFecha(fecha);
  }

  @Get('turnos')
  listarTurnos() {
    return this.service.listarTurnosParametrizados();
  }

  @Post('turnos')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_visitantes', 'actualizar_visitas')
  crearTurno(@Body() body: Record<string, unknown>) {
    return this.service.crearTurnoParametrizado(body ?? {});
  }

  @Put('turnos/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_visitantes', 'actualizar_visitas')
  actualizarTurno(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.actualizarTurnoParametrizado(id, body ?? {});
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'ver_solicitudes_visitantes',
    'administrar_solicitudes_visitantes',
  )
  listarAdmin(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.listarAdmin({ desde, hasta });
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_visitantes', 'actualizar_visitas')
  crear(@Body() body: Record<string, unknown>) {
    return this.service.crear(body ?? {});
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_visitantes', 'actualizar_visitas')
  actualizar(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.actualizar(id, body ?? {});
  }
}
