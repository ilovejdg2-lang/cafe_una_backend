import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { EmailService } from '../common/email.service';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { VisitasService } from '../services/visitas.service';

function texto(valor: unknown): string {
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' && Number.isFinite(valor)) return String(valor);
  return '';
}

function textoOpcional(valor: unknown): string | null {
  return texto(valor) || null;
}

function booleano(valor: unknown): boolean {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor === 1;
  if (typeof valor !== 'string') return false;
  return ['true', '1', 'sí', 'si'].includes(valor.trim().toLowerCase());
}

@Controller('visitas/solicitudes')
export class VisitasController {
  private readonly logger = new Logger(VisitasController.name);

  constructor(
    private readonly visitasService: VisitasService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Obtener todas las solicitudes de visitas (uso administrativo).
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'ver_solicitudes_visitantes',
    'administrar_solicitudes_visitantes',
  )
  obtenerSolicitudes(
    @Query('estado') estado?: string,
    @Query('tipoVisitante') tipoVisitante?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    return this.visitasService.obtenerSolicitudes({
      estado,
      tipoVisitante,
      fechaDesde,
      fechaHasta,
      busqueda,
    });
  }

  /**
   * Obtener solicitudes de un usuario específico.
   */
  @Get('usuario/:userId')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('crear_solicitud_visitante', 'ver_solicitudes_visitantes')
  obtenerSolicitudesDeUsuario(
    @Param('userId') userId: string,
    @Req()
    req: Request & {
      user: {
        userId: number;
        roles?: string[];
      };
    },
  ) {
    const usuarioAutenticado = String(req.user.userId);
    const esAdmin = req.user.roles?.some(
      (rol) => rol === 'Admin' || rol === 'SuperAdmin',
    );

    if (userId !== usuarioAutenticado && !esAdmin) {
      throw new ForbiddenException(
        'No tiene permiso para consultar solicitudes de otro usuario.',
      );
    }

    return this.visitasService.obtenerSolicitudesDeUsuario(userId);
  }

  /**
   * Crear solicitud de visita grupal.
   * Accesible públicamente o por usuario autenticado.
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('crear_solicitud_visitante')
  async crearSolicitud(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user?: { userId?: number; email?: string } },
  ) {
    try {
      const userId = req?.user?.userId ? String(req.user.userId) : null;

      const solicitud = await this.visitasService.crear({
        UserId: userId,
        EncargadoNombre: texto(body.EncargadoNombre ?? body.nombre),
        EncargadoIdentificacion: texto(
          body.EncargadoIdentificacion ?? body.identificacion,
        ),
        EncargadoEmail: texto(body.EncargadoEmail ?? body.email),
        EncargadoTelefono: texto(body.EncargadoTelefono ?? body.telefono),
        EncargadoInstitucion: textoOpcional(body.EncargadoInstitucion),
        TipoVisitante:
          texto(body.TipoVisitante ?? body.tipoVisitante) || 'Nacional',
        PaisProcedencia: textoOpcional(body.PaisProcedencia),
        CiudadProvincia: texto(body.CiudadProvincia ?? body.ciudadProvincia),
        CantidadVisitantes:
          Number(body.CantidadVisitantes ?? body.cantidadVisitantes) || 0,
        TipoGrupo: texto(body.TipoGrupo ?? body.tipoGrupo),
        TipoGrupoOtro: textoOpcional(body.TipoGrupoOtro),
        DisponibilidadVisitaId: texto(
          body.DisponibilidadVisitaId ?? body.disponibilidadVisitaId,
        ),
        FechaAlternativa: textoOpcional(body.FechaAlternativa),
        DuracionEstimada: textoOpcional(body.DuracionEstimada),
        AreaVisita: textoOpcional(body.AreaVisita),
        MotivoVisita: texto(body.MotivoVisita ?? body.motivoVisita),
        MotivoOtro: textoOpcional(body.MotivoOtro),
        RequiereAccesibilidad: booleano(
          body.RequiereAccesibilidad ?? body.requiereAccesibilidad,
        ),
        RequiereParqueoBus: booleano(
          body.RequiereParqueoBus ?? body.requiereParqueoBus,
        ),
        RequiereGuia: booleano(body.RequiereGuia ?? body.requiereGuia),
        Observaciones: textoOpcional(body.Observaciones),
      });

      if (solicitud.EncargadoEmail) {
        try {
          await this.emailService.enviarConfirmacionVisitaGrupal(
            solicitud.EncargadoEmail,
            {
              nombreEncargado: solicitud.EncargadoNombre,
              fechaVisita: solicitud.FechaVisita,
              cantidad: solicitud.CantidadVisitantes,
            },
          );
        } catch (emailError) {
          this.logger.warn(
            `No se pudo enviar correo de confirmación de visita a ${solicitud.EncargadoEmail}: ${emailError}`,
          );
        }
      }

      return solicitud;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({
        message:
          error instanceof Error
            ? error.message
            : 'Error al crear la solicitud de visita grupal.',
      });
    }
  }

  /**
   * Actualizar solicitud de visita grupal (Administrativo).
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_visitantes', 'actualizar_visitas')
  async actualizarSolicitud(
    @Param('id') id: string,
    @Body() cambios: Record<string, unknown>,
  ) {
    const existente = await this.visitasService.obtenerPorId(id);
    if (!existente) {
      throw new NotFoundException(
        'No se encontró la solicitud de visita grupal.',
      );
    }

    const estadoAnterior = String(existente.Estado ?? '').trim();
    const actualizada = await this.visitasService.actualizar(id, cambios);

    const estadoNuevo = String(actualizada.Estado ?? '').trim();
    const email = String(actualizada.EncargadoEmail ?? '')
      .trim()
      .toLowerCase();

    if (estadoNuevo && estadoAnterior !== estadoNuevo && email) {
      const hoy = new Date();
      const fechaActualizacion = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

      try {
        await this.emailService.enviarActualizacionEstadoVisitaGrupal(email, {
          nombreEncargado: actualizada.EncargadoNombre || 'Encargado/a',
          fechaVisita: actualizada.FechaVisita,
          estado: estadoNuevo,
          fechaActualizacion,
          motivoRechazo:
            estadoNuevo.toLowerCase() === 'rechazada' ||
            estadoNuevo.toLowerCase() === 'rechazado'
              ? actualizada.ObservacionesAdmin
              : null,
        });
      } catch (emailError) {
        this.logger.warn(
          `No se pudo enviar actualización de correo de visita a ${email}: ${emailError}`,
        );
      }
    }

    return actualizada;
  }

  /**
   * Inactivar una solicitud de visita grupal (Soft Delete).
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_visita', 'administrar_solicitudes_visitantes')
  async eliminarSolicitud(@Param('id') id: string) {
    const ok = await this.visitasService.eliminar(id);
    if (!ok) {
      throw new NotFoundException(
        'No se encontró la solicitud de visita grupal.',
      );
    }

    return {
      message: 'Solicitud de visita grupal inactivada correctamente.',
    };
  }
}
