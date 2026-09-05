import {
  Body,
  Controller,
  Delete,
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
import { FechasVoluntariadoService } from '../services/fechas-voluntariado.service';

@Controller('voluntariado/fechas')
export class FechasVoluntariadoController {
  constructor(
    private readonly fechasService: FechasVoluntariadoService,
  ) {}

  /**
   * Obtener fechas disponibles a partir de hoy.
   * Endpoint público utilizado por el formulario de voluntariado.
   */
  @Get('disponibles')
  listarDisponibles(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.fechasService.listarDisponibles(desde, hasta);
  }

  /**
   * Obtener todas las fechas para la gestión administrativa.
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'ver_solicitudes_voluntariado',
    'administrar_solicitudes_voluntariado',
  )
  listarTodas(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.fechasService.listarTodas(desde, hasta);
  }

  /**
   * Habilitar una nueva fecha o actualizar fecha existente.
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  habilitarFecha(@Body() body: Record<string, unknown>) {
    const fecha = String(body.fecha ?? body.Fecha ?? '');
    const cupo = body.cupoMaximo ?? body.CupoMaximo;
    const observaciones = String(body.observaciones ?? body.Observaciones ?? '');
    return this.fechasService.habilitarFecha(
      fecha,
      cupo != null ? Number(cupo) : null,
      observaciones,
    );
  }

  /**
   * Actualizar estado de una fecha específica.
   */
  @Put(':fecha')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  actualizarFecha(
    @Param('fecha') fecha: string,
    @Body() body: Record<string, unknown>,
  ) {
    const habilitada =
      body.habilitada !== undefined
        ? Boolean(body.habilitada)
        : body.Habilitada !== undefined
        ? Boolean(body.Habilitada)
        : true;
    const cupo = body.cupoMaximo ?? body.CupoMaximo;
    const observaciones = String(body.observaciones ?? body.Observaciones ?? '');
    return this.fechasService.actualizarEstado(
      fecha,
      habilitada,
      cupo != null ? Number(cupo) : null,
      observaciones,
    );
  }

  /**
   * Alternar estado (toggle) de una fecha.
   */
  @Post(':fecha/toggle')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  toggleFecha(@Param('fecha') fecha: string) {
    return this.fechasService.toggleFecha(fecha);
  }

  /**
   * Deshabilitar o eliminar una fecha.
   */
  @Delete(':fecha')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  async eliminarFecha(@Param('fecha') fecha: string) {
    await this.fechasService.eliminarFecha(fecha);
    return { ok: true, mensaje: `Fecha ${fecha} eliminada correctamente.` };
  }
}
