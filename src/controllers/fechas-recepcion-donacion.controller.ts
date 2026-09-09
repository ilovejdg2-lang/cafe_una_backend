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
import { FechasRecepcionDonacionService } from '../services/fechas-recepcion-donacion.service';

@Controller('v1/donaciones/fechas-recepcion')
export class FechasRecepcionDonacionController {
  constructor(
    private readonly fechasService: FechasRecepcionDonacionService,
  ) {}

  @Get('disponibles')
  listarDisponibles(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.fechasService.listarDisponibles(desde, hasta);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'ver_solicitudes_donacion',
    'administrar_solicitudes_donaciones',
  )
  listarTodas(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.fechasService.listarTodas(desde, hasta);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_donaciones')
  habilitarFecha(@Body() body: Record<string, unknown>) {
    const fecha = String(body.fecha ?? body.Fecha ?? '');
    const horarios = (body.horarios ?? body.Horarios) as string[] | undefined;
    const observaciones = String(body.observaciones ?? body.Observaciones ?? '');
    return this.fechasService.habilitarFecha(fecha, horarios, observaciones);
  }

  @Put(':fecha')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_donaciones')
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
    const horarios = (body.horarios ?? body.Horarios) as string[] | undefined;
    const observaciones = String(body.observaciones ?? body.Observaciones ?? '');
    return this.fechasService.actualizarEstado(
      fecha,
      habilitada,
      horarios,
      observaciones,
    );
  }

  @Post(':fecha/toggle')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_donaciones')
  toggleFecha(@Param('fecha') fecha: string) {
    return this.fechasService.toggleFecha(fecha);
  }

  @Delete(':fecha')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_donaciones')
  async eliminarFecha(@Param('fecha') fecha: string) {
    await this.fechasService.eliminarFecha(fecha);
    return {
      ok: true,
      mensaje: `Fecha de recepción ${fecha} eliminada correctamente.`,
    };
  }
}
