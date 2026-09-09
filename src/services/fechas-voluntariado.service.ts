import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FechaVoluntariado } from '../entities/fecha-voluntariado.entity';

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

function hoyIso(): string {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

@Injectable()
export class FechasVoluntariadoService {
  constructor(
    @InjectRepository(FechaVoluntariado)
    private readonly repo: Repository<FechaVoluntariado>,
  ) {}

  /**
   * Obtener fechas habilitadas disponibles a partir de hoy (acceso público).
   * Si se provee `tipo`, filtra específicamente por ese tipo de voluntariado.
   */
  async listarDisponibles(
    tipo?: string,
    desde?: string,
    hasta?: string,
  ): Promise<FechaVoluntariado[]> {
    const fechaInicio = desde && FECHA_ISO_RE.test(desde) ? desde : hoyIso();
    const qb = this.repo.createQueryBuilder('fv');

    qb.where('fv.Habilitada = :habilitada', { habilitada: true })
      .andWhere('fv.Fecha >= :inicio', { inicio: fechaInicio });

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
   * Obtener resumen de disponibilidad por tipo de voluntariado a partir de hoy.
   */
  async obtenerResumenTipos(): Promise<{ tipo: string; total: number }[]> {
    const hoy = hoyIso();
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
   * Obtener todas las fechas registradas para el panel administrativo.
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
    const hoy = hoyIso();

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
   * Deshabilitar una fecha existente para un tipo de voluntariado.
   */
  async deshabilitarFecha(tipo: string, fecha: string): Promise<FechaVoluntariado> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);

    let registro = await this.repo.findOne({
      where: { TipoVoluntariado: t, Fecha: f },
    });

    if (!registro) {
      registro = this.repo.create({
        TipoVoluntariado: t,
        Fecha: f,
        Habilitada: false,
        Horarios: [],
      });
    } else {
      registro.Habilitada = false;
    }

    return this.repo.save(registro);
  }

  /**
   * Alternar estado habilitado/deshabilitado de una fecha para un tipo.
   */
  async toggleFecha(tipo: string, fecha: string): Promise<FechaVoluntariado> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const hoy = hoyIso();

    if (f < hoy) {
      throw new BadRequestException('No se pueden modificar fechas pasadas.');
    }

    let registro = await this.repo.findOne({
      where: { TipoVoluntariado: t, Fecha: f },
    });

    if (!registro) {
      registro = this.repo.create({
        TipoVoluntariado: t,
        Fecha: f,
        Habilitada: true,
        Horarios: [],
      });
    } else {
      registro.Habilitada = !registro.Habilitada;
    }

    return this.repo.save(registro);
  }

  /**
   * Actualizar estado específico de una fecha para un tipo de voluntariado.
   */
  async actualizarEstado(
    tipo: string,
    fecha: string,
    habilitada: boolean,
    horarios?: string[],
    cupoMaximo?: number | null,
    observaciones?: string,
  ): Promise<FechaVoluntariado> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const hoy = hoyIso();

    if (habilitada && f < hoy) {
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
   */
  async eliminarFecha(tipo: string, fecha: string): Promise<void> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);

    const registro = await this.repo.findOne({
      where: { TipoVoluntariado: t, Fecha: f },
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
   */
  async estaFechaYHorarioHabilitada(
    tipo: string,
    fecha: string,
    horario?: string,
  ): Promise<{ valida: boolean; mensajeError?: string }> {
    const f = normalizarFecha(fecha);
    const t = normalizarTipo(tipo);
    const hoy = hoyIso();

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
      whereConditions.push({ TipoVoluntariado: 'General', Fecha: f, Habilitada: true });
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
    if (registro.Horarios && Array.isArray(registro.Horarios) && registro.Horarios.length > 0) {
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
