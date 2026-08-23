import {
  BadRequestException,
  Body,
  ConflictException,
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
import { VoluntariadoService } from '../services/voluntariado.service';

@Controller('voluntariado/solicitudes')
export class VoluntariadoController {
  private readonly logger = new Logger(VoluntariadoController.name);

  constructor(
    private readonly voluntariadoService: VoluntariadoService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Obtener todas las solicitudes.
   *
   * Uso administrativo.
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ver_solicitudes_voluntariado')
  obtenerSolicitudes(
    @Query('nombre') nombre?: string,
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.voluntariadoService.obtenerSolicitudes({
      nombre,
      tipo,
      estado,
      fecha,
    });
  }

  /**
   * Obtener las solicitudes de un usuario específico.
   *
   * Un usuario únicamente puede consultar sus propias solicitudes.
   * Admin y SuperAdmin pueden consultar las solicitudes de cualquier usuario.
   */
  @Get('usuario/:userId')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'ingresar_solicitud_voluntariado',
    'ver_solicitudes_voluntariado',
  )
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

    return this.voluntariadoService.obtenerSolicitudesDeUsuario(userId);
  }

  /**
   * Crear una solicitud de voluntariado.
   *
   * La solicitud siempre se asocia al usuario autenticado
   * mediante el JWT.
   *
   * El usuario no puede indicar otro UserId desde el frontend.
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ingresar_solicitud_voluntariado')
  async crearSolicitud(
    @Req()
    req: Request & {
      user: {
        userId: number;
        email?: string;
        unique_name?: string;
      };
    },
    @Body() body: Record<string, unknown>,
  ) {
    try {
      /*
       * El UserId viene directamente del JWT.
       */
      const userId = String(req.user.userId);

      /*
       * El correo también viene del usuario autenticado.
       * No confiamos en un correo enviado por el frontend.
       */
      const email = String(req.user.email ?? '')
        .trim()
        .toLowerCase();

      /*
       * El nombre se obtiene del JWT.
       *
       * Si posteriormente necesitan que el usuario pueda
       * completar/modificar información adicional de la solicitud,
       * esos campos sí vienen desde el formulario.
       */
      const nombreJwt = String(req.user.unique_name ?? '').trim();
      const nombreFormulario = [
        body.Nombre,
        body.PrimerApellido,
        body.SegundoApellido,
      ]
        .map((parte) => String(parte ?? '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
      const nombre = nombreFormulario || nombreJwt;

      const solicitud = await this.voluntariadoService.crear({
        UserId: userId,

        Nombre: nombre || null,
        Email: email || null,

        Telefono:
          body.Telefono !== undefined
            ? String(body.Telefono)
            : null,

        TipoVoluntariado:
          body.TipoVoluntariado !== undefined
            ? String(body.TipoVoluntariado)
            : null,

        Identificacion:
          body.Identificacion !== undefined
            ? String(body.Identificacion)
            : null,

        Institucion:
          body.Institucion !== undefined
            ? String(body.Institucion)
            : null,

        Pais:
          body.Pais !== undefined
            ? String(body.Pais)
            : null,

        Modalidad:
          body.Modalidad !== undefined
            ? String(body.Modalidad)
            : null,

        CantidadParticipantes:
          body.CantidadParticipantes != null
            ? Number(body.CantidadParticipantes)
            : null,

        Residencia:
          body.Residencia !== undefined
            ? String(body.Residencia)
            : null,

        Horario:
          body.Horario !== undefined
            ? String(body.Horario)
            : null,

        Dias:
          body.Dias !== undefined
            ? String(body.Dias)
            : null,

        Area:
          body.Area !== undefined
            ? String(body.Area)
            : null,

        Descripcion:
          body.Descripcion !== undefined
            ? String(body.Descripcion)
            : null,

        Motivacion:
          body.Motivacion !== undefined
            ? String(body.Motivacion)
            : null,
      });

      /*
       * Enviar correo de confirmación.
       *
       * Si el correo falla, NO se elimina la solicitud,
       * porque la solicitud ya fue correctamente registrada.
       */
      if (email) {
        try {
          await this.emailService.enviarConfirmacionVoluntariado(
            email,
            nombre || 'Voluntario/a',
          );
        } catch (emailError) {
          this.logger.warn(
            `No se pudo enviar correo de confirmación a ${email}: ${emailError}`,
          );
        }
      }

      return solicitud;
    } catch (error) {
      /*
       * Si el usuario ya tiene una solicitud pendiente,
       * el Service devuelve ConflictException (HTTP 409).
       *
       * No debemos convertirlo a BadRequestException (HTTP 400).
       */
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new BadRequestException({
        message:
          error instanceof Error
            ? error.message
            : 'Error al crear la solicitud de voluntariado.',
      });
    }
  }

  /**
   * Actualizar una solicitud.
   *
   * Este endpoint es administrativo.
   *
   * El usuario que creó la solicitud NO tiene permiso
   * para utilizar este endpoint simplemente por ser propietario.
   *
   * Admin/SuperAdmin deben tener los permisos correspondientes.
   */
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
    const existente = await this.voluntariadoService.obtenerPorId(id);
    if (!existente) {
      throw new NotFoundException(
        'No se encontró la solicitud de voluntariado.',
      );
    }

    const estadoAnterior = String(existente.Estado ?? '').trim();
    const actualizada = await this.voluntariadoService.actualizar(
      id,
      cambios as never,
    );

    if (!actualizada) {
      throw new NotFoundException(
        'No se encontró la solicitud de voluntariado.',
      );
    }

    const estadoNuevo = String(actualizada.Estado ?? '').trim();
    const email = String(actualizada.Email ?? '').trim().toLowerCase();

    if (estadoNuevo && estadoAnterior !== estadoNuevo && email) {
      const hoy = new Date();
      const fechaActualizacion = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}-${String(hoy.getUTCDate()).padStart(2, '0')}`;

      try {
        await this.emailService.enviarActualizacionEstadoVoluntariado(email, {
          nombre: actualizada.Nombre || 'Voluntario/a',
          tipoVoluntariado: actualizada.TipoVoluntariado || 'No indicado',
          periodo: actualizada.Dias || 'No indicado',
          estado: estadoNuevo,
          fechaActualizacion,
          motivoRechazo:
            estadoNuevo.toLowerCase() === 'rechazado'
              ? actualizada.ObservacionesAdmin
              : null,
        });
      } catch (emailError) {
        this.logger.warn(
          `No se pudo enviar correo de actualización a ${email}: ${emailError}`,
        );
      }
    }

    return actualizada;
  }

  /**
   * Inactivar una solicitud.
   *
   * El Service conserva el registro para mantener
   * el historial de solicitudes.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_voluntariado')
  async eliminarSolicitud(@Param('id') id: string) {
    const deleted = await this.voluntariadoService.eliminar(id);

    if (!deleted) {
      throw new NotFoundException(
        'No se encontró la solicitud de voluntariado.',
      );
    }

    return {
      message: 'Solicitud de voluntariado inactivada correctamente.',
    };
  }
}