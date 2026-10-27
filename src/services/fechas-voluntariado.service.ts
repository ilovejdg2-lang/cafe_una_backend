import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../common/email.service';
import {
  fechaHoraIsoEnZona,
  hoyIsoEnZona,
  obtenerZonaHoraria,
} from '../common/timezone.util';
import { FechaVoluntariado } from '../entities/fecha-voluntariado.entity';
import { SolicitudVoluntariado } from '../entities/solicitud-voluntariado.entity';

const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizarFecha(fecha: string): string {
  const f = String(fecha || '').trim().slice(0, 10);
  if (!FECHA_ISO_RE.test(f)) {
    throw new BadRequestException('Formato de fecha inválido (use AAAA-MM-DD).');
  }
  return f;
}

function normalizarTipo(tipo?: string): string {
  const t = String(tipo || '').trim();
  return t || 'General';
}

function normalizarHorarios(horarios?: unknown): string[] {
  if (!horarios) return [];
  if (Array.isArray(horarios)) {
    return horarios
      .map((h) => String(h || '').trim())
      .filter((h) => h.length > 0);
  }
  if (typeof horarios === 'string') {
    return horarios
      .split(',')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);
  }
  return [];
}

const ESTADOS_CANCELADOS = ['cancelada', 'cancelado'];
const ESTADOS_RECHAZADOS = ['rechazada', 'rechazado'];

@Injectable()
export class FechasVoluntariadoService {
  private readonly logger = new Logger(FechasVoluntariadoService.name);

  constructor(
    @InjectRepository(FechaVoluntariado)
    private readonly repo: Repository<FechaVoluntariado>,
    @InjectRepository(SolicitudVoluntariado)
    private readonly solicitudRepo: Repository<SolicitudVoluntariado>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Información de configuración de zona horaria y fecha vigente actual.
   */
  obtenerConfigZonaHoraria(): {
    zonaHoraria: string;
    hoy: string;
    fechaHoraActual: string;
  } {
    const tz = obtenerZonaHoraria();
    return {
      zonaHoraria: tz,
      hoy: hoyIsoEnZona(tz),
      fechaHoraActual: fechaHoraIsoEnZona(tz),
    };
  }

  /**
   * Obtener fechas habilitadas disponibles a partir de hoy (acceso público).
   * Se calculan exclusivamente fechas vigentes (Fecha >= hoy) según la zona horaria configurada.
   * Incluso si se pasa un parámetro `desde` manipulado en el pasado, se descarta y se fija como mínimo hoy.
   */
  async listarDisponibles(
    tipo?: string,
    desde?: string,
    hasta?: string,
  ): Promise<FechaVoluntariado[]> {
    const hoy = hoyIsoEnZona();
    const fechaInicio =
      desde && FECHA_ISO_RE.test(desde) && desde > hoy ? desde : hoy;
    const qb = this.repo.createQueryBuilder('fv');

    qb.where('fv.Habilitada = :habilitada', { habilitada: true }).andWhere(
      'fv.Fecha >= :inicio',
      { inicio: fechaInicio },
    );

    if (tipo && tipo.trim()) {
      if (tipo.trim().toLowerCase() === 'apoyo general') {
        qb.andWhere(
          '(LOWER(fv.TipoVoluntariado) = LOWER(:tipo) OR fv.TipoVoluntariado = :general)',
          { tipo: tipo.trim(), general: 'General' },
        );
      } else {
        qb.andWhere('LOWER(fv.TipoVoluntariado) = LOWER(:tipo)', {
          tipo: tipo.trim(),
        });
      }
    }

    if (hasta && FECHA_ISO_RE.test(hasta)) {
      qb.andWhere('fv.Fecha <= :hasta', { hasta });
    }

    return qb.orderBy('fv.Fecha', 'ASC').getMany();
  }

  /**
   * Obtener resumen de disponibilidad por tipo de voluntariado a partir de hoy en la zona horaria configurada.
   */
  async obtenerResumenTipos(): Promise<{ tipo: string; total: number }[]> {
    const hoy = hoyIsoEnZona();
    const qb = this.repo
      .createQueryBuilder('fv')
      .select('fv.TipoVoluntariado', 'tipo')
      .addSelect('COUNT(fv.Id)', 'total')
      .where('fv.Habilitada = :habilitada', { habilitada: true })
      .andWhere('fv.Fecha >= :hoy', { hoy })
      .groupBy('fv.TipoVoluntariado');

    const raw = await qb.getRawMany<{ tipo: string; total: string }>();
    const mapa = new Map<string, number>();

    for (const r of raw) {
      if (r.tipo) {
        const nombreTipo = r.tipo === 'General' ? 'Apoyo General' : r.tipo;
        const count = Number(r.total) || 0;
        mapa.set(nombreTipo, (mapa.get(nombreTipo) || 0) + count);
      }
    }

    return Array.from(mapa.entries()).map(([tipo, total]) => ({ tipo, total }));
  }

  /**
   * Obtener todas las fechas registradas para el panel administrativo (incluye históricas).
   */
  async listarTodas(
    tipo?: string,
    desde?: string,
    hasta?: string,
  ): Promise<FechaVoluntariado[]> {
    const qb = this.repo.createQueryBuilder('fv');

    if (tipo && tipo.trim()) {
      if (tipo.trim().toLowerCase() === 'apoyo general') {
        qb.andWhere(
          '(LOWER(fv.TipoVoluntariado) = LOWER(:tipo) OR fv.TipoVoluntariado = :general)',
          { tipo: tipo.trim(), general: 'General' },
        );
      } else {
        qb.andWhere('LOWER(fv.TipoVoluntariado) = LOWER(:tipo)', {
          tipo: tipo.trim(),
        });
      }
    }

    if (desde && FECHA_ISO_RE.test(desde)) {
      qb.andWhere('fv.Fecha >= :desde', { desde });
    }
    if (hasta && FECHA_ISO_RE.test(hasta)) {
      qb.andWhere('fv.Fecha <= :hasta', { hasta });
    }

    return qb.orderBy('fv.Fecha', 'ASC').getMany();
  }

  /**
   * Detecta y devuelve solicitudes vinculadas a una fecha y tipo de voluntariado.
   */
  async obtenerSolicitudesVinculadas(
    tipo: string,
    fecha: string,
  ): Promise<{
    fecha: string;
    tipo: string;
    total: number;
    activas: number;
    canceladasPreviamente: number;
    solicitudes: SolicitudVoluntariado[];
  }> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);

    const qb = this.solicitudRepo.createQueryBuilder('sol');
    qb.where('sol.Dias LIKE :fechaParam', { fechaParam: `%${f}%` });

    if (t.toLowerCase() === 'apoyo general') {
      qb.andWhere(
        '(LOWER(sol.TipoVoluntariado) = LOWER(:t) OR sol.TipoVoluntariado = :gen OR sol.TipoVoluntariado IS NULL)',
        { t, gen: 'General' },
      );
    } else {
      qb.andWhere(
        '(LOWER(sol.TipoVoluntariado) = LOWER(:t) OR sol.TipoVoluntariado IS NULL)',
        { t },
      );
    }

    const vinculadas = await qb.orderBy('sol.Id', 'ASC').getMany();

    let activas = 0;
    let canceladasPreviamente = 0;

    for (const s of vinculadas) {
      const estadoNorm = String(s.Estado || '').trim().toLowerCase();
      if (ESTADOS_CANCELADOS.includes(estadoNorm)) {
        canceladasPreviamente++;
      } else if (!ESTADOS_RECHAZADOS.includes(estadoNorm)) {
        activas++;
      }
    }

    return {
      fecha: f,
      tipo: t,
      total: vinculadas.length,
      activas,
      canceladasPreviamente,
      solicitudes: vinculadas,
    };
  }

  /**
   * Cancela la actividad de una fecha futura:
   * 1. Conserva las solicitudes asociadas en la base de datos (no se borran).
   * 2. Actualiza el estado a 'Cancelada' y anota la observación administrativa.
   * 3. Notifica a cada participante que la actividad se canceló, con fecha, tipo y orientación.
   * 4. Registra NotificacionCancelacionEnviada = true para que reintentos NO dupliquen avisos.
   * 5. Retira la fecha según la acción solicitada ('deshabilitar' o 'eliminar').
   */
  async cancelarActividadYRetirarFecha(
    tipo: string,
    fecha: string,
    accion: 'deshabilitar' | 'eliminar',
    orientacion?: string,
  ): Promise<{
    ok: boolean;
    accion: string;
    fecha: string;
    tipo: string;
    solicitudesCanceladas: number;
    notificacionesExitosas: number;
    notificacionesFallidas: number;
    fallidos: Array<{ id: string; email: string; error?: string }>;
  }> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const info = await this.obtenerSolicitudesVinculadas(t, f);

    const fallidos: Array<{ id: string; email: string; error?: string }> = [];
    let solicitudesCanceladas = 0;
    let notificacionesExitosas = 0;
    let notificacionesFallidas = 0;

    const fechaHora = fechaHoraIsoEnZona();
    const textoOrientacion = orientacion?.trim() || '';
    const notaCancelacion = textoOrientacion
      ? `Actividad cancelada el ${fechaHora}. Orientación: ${textoOrientacion}`
      : `Actividad cancelada el ${fechaHora} por la administración.`;

    for (const solicitud of info.solicitudes) {
      const estadoNorm = String(solicitud.Estado || '').trim().toLowerCase();

      // Si ya está rechazada, no interfiere
      if (ESTADOS_RECHAZADOS.includes(estadoNorm)) {
        continue;
      }

      // Si no estaba cancelada aún, cambiar su estado a 'Cancelada' y guardar la orientación
      if (!ESTADOS_CANCELADOS.includes(estadoNorm)) {
        solicitud.Estado = 'Cancelada';
        const obsAnterior = solicitud.ObservacionesAdmin
          ? `${solicitud.ObservacionesAdmin}\n`
          : '';
        solicitud.ObservacionesAdmin = `${obsAnterior}[${notaCancelacion}]`;
        await this.solicitudRepo.save(solicitud);
        solicitudesCanceladas++;
      }

      // Enviar notificación por correo si no se ha enviado previamente (idempotencia ante reintentos)
      if (!solicitud.NotificacionCancelacionEnviada) {
        const email = String(solicitud.Email || '').trim();
        if (email) {
          try {
            const enviado =
              await this.emailService.enviarCancelacionActividadVoluntariado(
                email,
                {
                  nombre: solicitud.Nombre || 'Voluntario/a',
                  tipoVoluntariado: solicitud.TipoVoluntariado || t,
                  fechaActividad: f,
                  horario: solicitud.Horario,
                  orientacion: textoOrientacion || undefined,
                },
              );

            if (enviado) {
              solicitud.NotificacionCancelacionEnviada = true;
              await this.solicitudRepo.save(solicitud);
              notificacionesExitosas++;
            } else {
              notificacionesFallidas++;
              fallidos.push({
                id: String(solicitud.Id),
                email,
                error: 'El servicio de correo no pudo entregar el mensaje.',
              });
            }
          } catch (err) {
            notificacionesFallidas++;
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Error al notificar cancelación a ${email}: ${msg}`,
            );
            fallidos.push({ id: String(solicitud.Id), email, error: msg });
          }
        }
      }
    }

    // Retirar la fecha en fechas_voluntariado según la acción solicitada
    const whereConditions: Array<Record<string, unknown>> = [
      { TipoVoluntariado: t, Fecha: f },
    ];
    if (t.toLowerCase() === 'apoyo general') {
      whereConditions.push({ TipoVoluntariado: 'General', Fecha: f });
    }

    const registro = await this.repo.findOne({ where: whereConditions });

    if (accion === 'eliminar') {
      if (registro) {
        await this.repo.remove(registro);
      }
    } else {
      // deshabilitar
      if (registro) {
        registro.Habilitada = false;
        await this.repo.save(registro);
      } else {
        const nuevo = this.repo.create({
          TipoVoluntariado: t,
          Fecha: f,
          Habilitada: false,
          Horarios: [],
        });
        await this.repo.save(nuevo);
      }
    }

    return {
      ok: true,
      accion: accion === 'eliminar' ? 'eliminada' : 'deshabilitada',
      fecha: f,
      tipo: t,
      solicitudesCanceladas,
      notificacionesExitosas,
      notificacionesFallidas,
      fallidos,
    };
  }

  /**
   * Reintenta el envío de notificaciones pendientes para solicitudes canceladas.
   * Solo envía a participantes cuya `NotificacionCancelacionEnviada` sea false,
   * garantizando que los reintentos NO dupliquen avisos a los ya notificados.
   */
  async reintentarNotificaciones(
    tipo: string,
    fecha: string,
    orientacion?: string,
  ): Promise<{
    totalPendientes: number;
    notificacionesExitosas: number;
    notificacionesFallidas: number;
    fallidos: Array<{ id: string; email: string; error?: string }>;
  }> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const info = await this.obtenerSolicitudesVinculadas(t, f);

    const pendientes = info.solicitudes.filter(
      (s) =>
        ESTADOS_CANCELADOS.includes(String(s.Estado || '').trim().toLowerCase()) &&
        !s.NotificacionCancelacionEnviada &&
        Boolean(s.Email?.trim()),
    );

    let notificacionesExitosas = 0;
    let notificacionesFallidas = 0;
    const fallidos: Array<{ id: string; email: string; error?: string }> = [];

    for (const solicitud of pendientes) {
      const email = String(solicitud.Email || '').trim();
      try {
        const enviado =
          await this.emailService.enviarCancelacionActividadVoluntariado(email, {
            nombre: solicitud.Nombre || 'Voluntario/a',
            tipoVoluntariado: solicitud.TipoVoluntariado || t,
            fechaActividad: f,
            horario: solicitud.Horario,
            orientacion: orientacion?.trim() || undefined,
          });

        if (enviado) {
          solicitud.NotificacionCancelacionEnviada = true;
          await this.solicitudRepo.save(solicitud);
          notificacionesExitosas++;
        } else {
          notificacionesFallidas++;
          fallidos.push({
            id: String(solicitud.Id),
            email,
            error: 'Fallo al entregar correo en el reintento.',
          });
        }
      } catch (err) {
        notificacionesFallidas++;
        const msg = err instanceof Error ? err.message : String(err);
        fallidos.push({ id: String(solicitud.Id), email, error: msg });
      }
    }

    return {
      totalPendientes: pendientes.length,
      notificacionesExitosas,
      notificacionesFallidas,
      fallidos,
    };
  }

  /**
   * Habilitar o crear una fecha disponible para un tipo de voluntariado específico.
   */
  async habilitarFecha(
    tipo: string,
    fecha: string,
    horarios?: string[],
    cupoMaximo?: number | null,
    observaciones?: string,
  ): Promise<FechaVoluntariado> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const hoy = hoyIsoEnZona();

    if (f < hoy) {
      throw new BadRequestException('No se pueden habilitar fechas pasadas.');
    }

    const horariosNormalizados = normalizarHorarios(horarios);

    let registro = await this.repo.findOne({
      where: { TipoVoluntariado: t, Fecha: f },
    });

    if (!registro) {
      registro = this.repo.create({
        TipoVoluntariado: t,
        Fecha: f,
        Habilitada: true,
        Horarios: horariosNormalizados,
        CupoMaximo: cupoMaximo ?? null,
        Observaciones: observaciones ? String(observaciones).trim() : '',
      });
    } else {
      registro.Habilitada = true;
      if (horarios !== undefined) registro.Horarios = horariosNormalizados;
      if (cupoMaximo !== undefined) registro.CupoMaximo = cupoMaximo;
      if (observaciones !== undefined)
        registro.Observaciones = String(observaciones).trim();
    }

    return this.repo.save(registro);
  }

  /**
   * Alternar estado habilitado/deshabilitado de una fecha para un tipo.
   */
  async toggleFecha(
    tipo: string,
    fecha: string,
    confirmarCancelacion = false,
    motivoCancelacion?: string,
  ): Promise<
    | FechaVoluntariado
    | {
        ok: boolean;
        accion: string;
        fecha: string;
        solicitudesCanceladas: number;
        notificacionesExitosas: number;
      }
  > {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const hoy = hoyIsoEnZona();

    if (f < hoy) {
      throw new BadRequestException('No se pueden modificar fechas pasadas.');
    }

    const whereConditions: Array<Record<string, unknown>> = [
      { TipoVoluntariado: t, Fecha: f },
    ];
    if (t.toLowerCase() === 'apoyo general') {
      whereConditions.push({ TipoVoluntariado: 'General', Fecha: f });
    }

    let registro = await this.repo.findOne({
      where: whereConditions,
    });

    const estadoActual = registro ? registro.Habilitada : false;
    const nuevoEstado = !estadoActual;

    // Si se va a deshabilitar y es fecha futura, verificar participantes vinculados
    if (!nuevoEstado) {
      return this.actualizarEstado(
        t,
        f,
        false,
        registro?.Horarios ?? [],
        registro?.CupoMaximo,
        registro?.Observaciones,
        confirmarCancelacion,
        motivoCancelacion,
      );
    }

    if (!registro) {
      registro = this.repo.create({
        TipoVoluntariado: t,
        Fecha: f,
        Habilitada: true,
        Horarios: [],
      });
    } else {
      registro.Habilitada = true;
    }

    return this.repo.save(registro);
  }

  /**
   * Actualizar estado específico de una fecha para un tipo de voluntariado.
   * Si se va a deshabilitar una fecha futura con participantes vinculados:
   * - Si confirmarCancelacion es false: lanza ConflictException con la lista de solicitudes.
   * - Si confirmarCancelacion es true: cancela las solicitudes, conserva registros y notifica.
   */
  async actualizarEstado(
    tipo: string,
    fecha: string,
    habilitada: boolean,
    horarios?: string[],
    cupoMaximo?: number | null,
    observaciones?: string,
    confirmarCancelacion = false,
    motivoCancelacion?: string,
  ): Promise<any> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const hoy = hoyIsoEnZona();

    if (habilitada && f < hoy) {
      throw new BadRequestException('No se pueden habilitar fechas pasadas.');
    }

    // Si se va a retirar/deshabilitar una fecha futura, verificar participantes
    if (!habilitada && f >= hoy) {
      const info = await this.obtenerSolicitudesVinculadas(t, f);
      if (info.activas > 0) {
        if (!confirmarCancelacion) {
          throw new ConflictException({
            message: `Existen ${info.activas} participante(s) con solicitud activa vinculada a esta fecha. Se requiere confirmar la cancelación para conservar las solicitudes y notificarles.`,
            requiereConfirmacion: true,
            solicitudesVinculadas: info.solicitudes.filter(
              (s) =>
                !ESTADOS_CANCELADOS.includes(
                  String(s.Estado || '').trim().toLowerCase(),
                ) &&
                !ESTADOS_RECHAZADOS.includes(
                  String(s.Estado || '').trim().toLowerCase(),
                ),
            ),
          });
        }

        // Si se confirmó la cancelación, ejecutar cancelación segura y notificaciones
        return this.cancelarActividadYRetirarFecha(
          t,
          f,
          'deshabilitar',
          motivoCancelacion,
        );
      }
    }

    const horariosNormalizados = normalizarHorarios(horarios);

    const whereConditions: Array<Record<string, unknown>> = [
      { TipoVoluntariado: t, Fecha: f },
    ];
    if (t.toLowerCase() === 'apoyo general') {
      whereConditions.push({ TipoVoluntariado: 'General', Fecha: f });
    }

    let registro = await this.repo.findOne({
      where: whereConditions,
    });

    if (!registro) {
      registro = this.repo.create({
        TipoVoluntariado: t,
        Fecha: f,
        Habilitada: habilitada,
        Horarios: horariosNormalizados,
        CupoMaximo: cupoMaximo ?? null,
        Observaciones: observaciones ? String(observaciones).trim() : '',
      });
    } else {
      registro.Habilitada = habilitada;
      if (horarios !== undefined) registro.Horarios = horariosNormalizados;
      if (cupoMaximo !== undefined) registro.CupoMaximo = cupoMaximo;
      if (observaciones !== undefined)
        registro.Observaciones = String(observaciones).trim();
    }

    return this.repo.save(registro);
  }

  /**
   * Eliminar registro de fecha para un tipo de voluntariado.
   * Si es una fecha futura con participantes vinculados:
   * - Si confirmarCancelacion es false: lanza ConflictException.
   * - Si confirmarCancelacion es true: cancela solicitudes, notifica y remueve la fecha.
   */
  async eliminarFecha(
    tipo: string,
    fecha: string,
    confirmarCancelacion = false,
    motivoCancelacion?: string,
  ): Promise<any> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const hoy = hoyIsoEnZona();

    if (f >= hoy) {
      const info = await this.obtenerSolicitudesVinculadas(t, f);
      if (info.activas > 0) {
        if (!confirmarCancelacion) {
          throw new ConflictException({
            message: `Existen ${info.activas} participante(s) con solicitud activa vinculada a esta fecha. Se requiere confirmar la cancelación para conservar las solicitudes y notificarles.`,
            requiereConfirmacion: true,
            solicitudesVinculadas: info.solicitudes.filter(
              (s) =>
                !ESTADOS_CANCELADOS.includes(
                  String(s.Estado || '').trim().toLowerCase(),
                ) &&
                !ESTADOS_RECHAZADOS.includes(
                  String(s.Estado || '').trim().toLowerCase(),
                ),
            ),
          });
        }

        // Si se confirmó, cancelar y retirar mediante eliminación
        return this.cancelarActividadYRetirarFecha(
          t,
          f,
          'eliminar',
          motivoCancelacion,
        );
      }
    }

    const whereConditions: Array<Record<string, unknown>> = [
      { TipoVoluntariado: t, Fecha: f },
    ];
    if (t.toLowerCase() === 'apoyo general') {
      whereConditions.push({ TipoVoluntariado: 'General', Fecha: f });
    }

    const registro = await this.repo.findOne({
      where: whereConditions,
    });

    if (!registro) {
      throw new NotFoundException(
        `La fecha ${f} para el tipo "${t}" no se encuentra registrada.`,
      );
    }
    await this.repo.remove(registro);
  }

  /**
   * Valida si una fecha y horario específicos están habilitados para un tipo de voluntariado.
   * Rechaza estrictamente fechas pasadas según la zona horaria configurada.
   */
  async estaFechaYHorarioHabilitada(
    tipo: string,
    fecha: string,
    horario?: string,
  ): Promise<{ valida: boolean; mensajeError?: string }> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const hoy = hoyIsoEnZona();

    if (f < hoy) {
      return {
        valida: false,
        mensajeError: 'No se pueden solicitar voluntariados en fechas pasadas.',
      };
    }

    const whereConditions: Array<Record<string, unknown>> = [
      { TipoVoluntariado: t, Fecha: f, Habilitada: true },
    ];
    if (t.toLowerCase() === 'apoyo general') {
      whereConditions.push({
        TipoVoluntariado: 'General',
        Fecha: f,
        Habilitada: true,
      });
    }

    const registro = await this.repo.findOne({
      where: whereConditions,
    });

    if (!registro) {
      return {
        valida: false,
        mensajeError: `La fecha ${f} no está habilitada para el voluntariado de tipo "${t}".`,
      };
    }

    // Validar horario si el registro tiene horarios configurados
    if (
      registro.Horarios &&
      Array.isArray(registro.Horarios) &&
      registro.Horarios.length > 0
    ) {
      if (horario) {
        const hTrim = horario.trim();
        const coincide = registro.Horarios.some(
          (h) => h.toLowerCase() === hTrim.toLowerCase(),
        );
        if (!coincide) {
          return {
            valida: false,
            mensajeError: `El horario "${horario}" no está disponible para el voluntariado "${t}" en la fecha ${f}.`,
          };
        }
      }
    }

    return { valida: true };
  }
}
