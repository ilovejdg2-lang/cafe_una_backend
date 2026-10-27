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

function extraerTipo(
  paramTipo?: string,
  bodyTipo?: unknown,
  queryTipo?: string,
): string {
  if (paramTipo && String(paramTipo).trim()) {
    return String(paramTipo).trim();
  }
  if (bodyTipo != null && typeof bodyTipo === 'string' && bodyTipo.trim()) {
    return bodyTipo.trim();
  }
  if (
    bodyTipo != null &&
    String(bodyTipo).trim() &&
    String(bodyTipo).trim() !== '[object Object]'
  ) {
    return String(bodyTipo).trim();
  }
  if (queryTipo && String(queryTipo).trim()) {
    return String(queryTipo).trim();
  }
  return 'General';
}

@Controller('voluntariado/fechas')
export class FechasVoluntariadoController {
  constructor(private readonly fechasService: FechasVoluntariadoService) {}

  /**
   * Obtener configuración de zona horaria y fecha vigente.
   * Endpoint público utilizado por el frontend para sincronización precisa de fechas.
   */
  @Get('config')
  obtenerConfig() {
    return this.fechasService.obtenerConfigZonaHoraria();
  }

  /**
   * Obtener fechas disponibles a partir de hoy según la zona horaria configurada.
   * Endpoint público utilizado por el formulario de voluntariado.
   * Puede filtrarse por tipo específico de voluntariado.
   */
  @Get('disponibles')
  listarDisponibles(
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.fechasService.listarDisponibles(tipo, desde, hasta);
  }

  /**
   * Obtener resumen de disponibilidad de fechas por tipo de voluntariado a partir de hoy.
   * Endpoint público utilizado para mostrar el estado de disponibilidad en el selector.
   */
  @Get('resumen-tipos')
  obtenerResumenTipos() {
    return this.fechasService.obtenerResumenTipos();
  }

  /**
   * Obtener todas las fechas para la gestión administrativa (incluye históricas).
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'ver_solicitudes_voluntariado',
    'administrar_solicitudes_voluntariado',
  )
  listarTodas(
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.fechasService.listarTodas(tipo, desde, hasta);
  }

  /**
   * Detecta y lista solicitudes vinculadas a una fecha y tipo.
   * Endpoint administrativo que permite verificar antes de retirar una fecha si existen inscritos.
   */
  @Get(':fecha/solicitudes-vinculadas')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'ver_solicitudes_voluntariado',
    'administrar_solicitudes_voluntariado',
  )
  obtenerSolicitudesVinculadas(
    @Param('fecha') fecha: string,
    @Query('tipo') queryTipo?: string,
  ) {
    const tipo = extraerTipo(undefined, undefined, queryTipo);
    return this.fechasService.obtenerSolicitudesVinculadas(tipo, fecha);
  }

  /**
   * Cancelar actividad vinculada a una fecha y retirarla:
   * Conserva las solicitudes con estado Cancelada, notifica a los participantes
   * con la orientación dada y retira la fecha.
   */
  @Post(':fecha/cancelar-actividad')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  cancelarActividad(
    @Param('fecha') fecha: string,
    @Body() body: Record<string, unknown> = {},
    @Query('tipo') queryTipo?: string,
  ) {
    const tipo = extraerTipo(
      undefined,
      body.tipo ?? body.TipoVoluntariado ?? body.tipoVoluntariado,
      queryTipo,
    );
    const accion =
      String(body.accion || 'deshabilitar').toLowerCase() === 'eliminar'
        ? 'eliminar'
        : 'deshabilitar';
    const orientacion = String(
      body.orientacion ?? body.motivo ?? body.motivoCancelacion ?? '',
    );

    return this.fechasService.cancelarActividadYRetirarFecha(
      tipo,
      fecha,
      accion,
      orientacion,
    );
  }

  /**
   * Reintentar el envío de notificaciones pendientes a participantes
   * cuyas solicitudes hayan quedado sin enviar aviso (sin duplicar a los ya notificados).
   */
  @Post(':fecha/reintentar-notificaciones')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  reintentarNotificaciones(
    @Param('fecha') fecha: string,
    @Body() body: Record<string, unknown> = {},
    @Query('tipo') queryTipo?: string,
  ) {
    const tipo = extraerTipo(
      undefined,
      body.tipo ?? body.TipoVoluntariado ?? body.tipoVoluntariado,
      queryTipo,
    );
    const orientacion = String(
      body.orientacion ?? body.motivo ?? body.motivoCancelacion ?? '',
    );
    return this.fechasService.reintentarNotificaciones(
      tipo,
      fecha,
      orientacion,
    );
  }

  /**
   * Habilitar una nueva fecha o actualizar fecha existente para un tipo.
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  habilitarFecha(@Body() body: Record<string, unknown>) {
    const tipo = extraerTipo(
      undefined,
      body.tipo ?? body.TipoVoluntariado ?? body.tipoVoluntariado,
    );
    const fecha = String(body.fecha ?? body.Fecha ?? '');
    const horarios = (body.horarios ?? body.Horarios) as string[] | undefined;
    const cupo = body.cupoMaximo ?? body.CupoMaximo;
    const observaciones = String(
      body.observaciones ?? body.Observaciones ?? '',
    );

    return this.fechasService.habilitarFecha(
      tipo,
      fecha,
      horarios,
      cupo != null ? Number(cupo) : null,
      observaciones,
    );
  }

  /**
   * Actualizar estado de una fecha específica.
   * Si se va a deshabilitar una fecha futura con participantes, requiere confirmarCancelacion.
   */
  @Put(':fecha')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  actualizarFecha(
    @Param('fecha') fecha: string,
    @Body() body: Record<string, unknown>,
    @Query('tipo') queryTipo?: string,
  ) {
    const tipo = extraerTipo(
      undefined,
      body.tipo ?? body.TipoVoluntariado ?? body.tipoVoluntariado,
      queryTipo,
    );
    const habilitada =
      body.habilitada !== undefined
        ? Boolean(body.habilitada)
        : body.Habilitada !== undefined
        ? Boolean(body.Habilitada)
        : true;
    const horarios = (body.horarios ?? body.Horarios) as string[] | undefined;
    const cupo = body.cupoMaximo ?? body.CupoMaximo;
    const observaciones = String(
      body.observaciones ?? body.Observaciones ?? '',
    );
    const confirmarCancelacion = Boolean(
      body.confirmarCancelacion ?? body.confirmar ?? false,
    );
    const motivoCancelacion = String(
      body.motivoCancelacion ?? body.orientacion ?? body.motivo ?? '',
    );

    return this.fechasService.actualizarEstado(
      tipo,
      fecha,
      habilitada,
      horarios,
      cupo != null ? Number(cupo) : null,
      observaciones,
      confirmarCancelacion,
      motivoCancelacion,
    );
  }

  /**
   * Alternar estado (toggle) de una fecha.
   */
  @Post(':fecha/toggle')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  toggleFecha(
    @Param('fecha') fecha: string,
    @Body() body: Record<string, unknown> = {},
    @Query('tipo') queryTipo?: string,
  ) {
    const tipo = extraerTipo(
      undefined,
      body.tipo ?? body.TipoVoluntariado ?? body.tipoVoluntariado,
      queryTipo,
    );
    const confirmarCancelacion = Boolean(
      body.confirmarCancelacion ?? body.confirmar ?? false,
    );
    const motivoCancelacion = String(
      body.motivoCancelacion ?? body.orientacion ?? body.motivo ?? '',
    );

    return this.fechasService.toggleFecha(
      tipo,
      fecha,
      confirmarCancelacion,
      motivoCancelacion,
    );
  }

  /**
   * Eliminar una fecha para un tipo específico.
   * Si es futura y tiene participantes, requiere confirmarCancelacion.
   */
  @Delete(':fecha')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_voluntariado')
  async eliminarFecha(
    @Param('fecha') fecha: string,
    @Query('tipo') queryTipo?: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const tipo = extraerTipo(
      undefined,
      body.tipo ?? body.TipoVoluntariado ?? body.tipoVoluntariado,
      queryTipo,
    );
    const confirmarCancelacion = Boolean(
      body.confirmarCancelacion ?? body.confirmar ?? false,
    );
    const motivoCancelacion = String(
      body.motivoCancelacion ?? body.orientacion ?? body.motivo ?? '',
    );

    const resultado = await this.fechasService.eliminarFecha(
      tipo,
      fecha,
      confirmarCancelacion,
      motivoCancelacion,
    );

    return (
      resultado || {
        ok: true,
        mensaje: `Fecha ${fecha} para el tipo "${tipo}" eliminada correctamente.`,
      }
    );
  }
}
