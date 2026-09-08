import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisponibilidadGrupo } from '../entities/disponibilidad-grupo.entity';

const TIPOS = new Set(['visitas', 'voluntariado']);
const HORA_RE = /^\d{2}:\d{2}$/;

/** Horario base Café UNA (lun–vie). */
export const HORA_APERTURA_DEFAULT = '08:00';
export const HORA_CIERRE_DEFAULT = '17:00';

function parseFechaLocal(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function esFinDeSemana(fecha: string): boolean {
  const day = parseFechaLocal(fecha).getDay();
  return day === 0 || day === 6;
}

function hoyIso(): string {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysIso(fecha: string, days: number): string {
  const d = parseFechaLocal(fecha);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class DisponibilidadGruposService {
  constructor(
    @InjectRepository(DisponibilidadGrupo)
    private readonly repo: Repository<DisponibilidadGrupo>,
  ) {}

  reglasBase() {
    return {
      horaApertura: HORA_APERTURA_DEFAULT,
      horaCierre: HORA_CIERRE_DEFAULT,
      diasLaborables: [1, 2, 3, 4, 5],
      mensaje:
        'Lunes a viernes de 8:00 a. m. a 5:00 p. m. Sábados y domingos no están disponibles.',
    };
  }

  async listarExcepciones(tipo?: string): Promise<DisponibilidadGrupo[]> {
    const where =
      tipo && TIPOS.has(tipo) ? { Tipo: tipo } : undefined;
    return this.repo.find({
      where,
      order: { Fecha: 'ASC', Id: 'ASC' },
    });
  }

  /**
   * Calendario resuelto: días laborables con horario default u excepción.
   * Fines de semana nunca se incluyen.
   */
  async listarPublicos(
    tipo: string,
    desde?: string,
    hasta?: string,
  ): Promise<
    {
      fecha: string;
      horaInicio: string;
      horaFin: string;
      disponible: boolean;
      esExcepcion: boolean;
      nota: string;
    }[]
  > {
    if (!TIPOS.has(tipo)) {
      throw new BadRequestException('Tipo debe ser visitas o voluntariado.');
    }

    const inicio = desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : hoyIso();
    const fin =
      hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)
        ? hasta
        : addDaysIso(inicio, 60);

    if (fin < inicio) {
      throw new BadRequestException('El rango de fechas es inválido.');
    }

    const excepciones = await this.repo.find({ where: { Tipo: tipo } });
    const porFecha = new Map(
      excepciones.map((e) => [String(e.Fecha).slice(0, 10), e]),
    );

    const out: {
      fecha: string;
      horaInicio: string;
      horaFin: string;
      disponible: boolean;
      esExcepcion: boolean;
      nota: string;
    }[] = [];

    for (
      let cursor = inicio;
      cursor <= fin;
      cursor = addDaysIso(cursor, 1)
    ) {
      if (esFinDeSemana(cursor)) continue;

      const exc = porFecha.get(cursor);
      if (!exc) {
        out.push({
          fecha: cursor,
          horaInicio: HORA_APERTURA_DEFAULT,
          horaFin: HORA_CIERRE_DEFAULT,
          disponible: true,
          esExcepcion: false,
          nota: '',
        });
        continue;
      }

      if (!exc.Disponible) {
        out.push({
          fecha: cursor,
          horaInicio: '',
          horaFin: '',
          disponible: false,
          esExcepcion: true,
          nota: exc.Nota || '',
        });
        continue;
      }

      out.push({
        fecha: cursor,
        horaInicio: exc.HoraInicio || HORA_APERTURA_DEFAULT,
        horaFin: exc.HoraFin || HORA_CIERRE_DEFAULT,
        disponible: true,
        esExcepcion: true,
        nota: exc.Nota || '',
      });
    }

    return out;
  }

  async upsertExcepcion(
    body: Record<string, unknown>,
  ): Promise<DisponibilidadGrupo> {
    const datos = this.normalizarExcepcion(body);
    const existente = await this.repo.findOne({
      where: { Tipo: datos.Tipo!, Fecha: datos.Fecha! },
    });
    if (existente) {
      Object.assign(existente, datos);
      return this.repo.save(existente);
    }
    return this.repo.save(this.repo.create(datos));
  }

  async actualizar(
    id: number,
    body: Record<string, unknown>,
  ): Promise<DisponibilidadGrupo> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) {
      throw new NotFoundException('Excepción de horario no encontrada.');
    }
    const datos = this.normalizarExcepcion(
      { ...actual, ...body, tipo: body.tipo ?? body.Tipo ?? actual.Tipo },
      true,
    );
    Object.assign(actual, datos);
    return this.repo.save(actual);
  }

  async eliminar(id: number): Promise<void> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) {
      throw new NotFoundException('Excepción de horario no encontrada.');
    }
    await this.repo.remove(actual);
  }

  /** Quitar excepción por fecha+tipo (vuelve al horario normal 8–5). */
  async eliminarPorFecha(tipo: string, fecha: string): Promise<void> {
    const t = String(tipo || '').toLowerCase();
    const f = String(fecha || '').slice(0, 10);
    if (!TIPOS.has(t)) {
      throw new BadRequestException('Tipo debe ser visitas o voluntariado.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      throw new BadRequestException('Fecha inválida.');
    }
    if (esFinDeSemana(f)) {
      throw new BadRequestException(
        'Sábados y domingos no tienen horario laborable.',
      );
    }
    const actual = await this.repo.findOne({ where: { Tipo: t, Fecha: f } });
    if (actual) await this.repo.remove(actual);
  }

  private normalizarExcepcion(
    body: Record<string, unknown>,
    parcial = false,
  ): Partial<DisponibilidadGrupo> {
    const tipo = String(body.tipo ?? body.Tipo ?? '')
      .trim()
      .toLowerCase();
    if (!parcial || body.tipo != null || body.Tipo != null) {
      if (!TIPOS.has(tipo)) {
        throw new BadRequestException('Tipo debe ser visitas o voluntariado.');
      }
    }

    const fechaRaw = body.fecha ?? body.Fecha;
    const fecha = fechaRaw != null ? String(fechaRaw).slice(0, 10) : '';
    if (!parcial || fechaRaw != null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new BadRequestException('Fecha inválida (use AAAA-MM-DD).');
      }
      if (esFinDeSemana(fecha)) {
        throw new BadRequestException(
          'No se pueden configurar sábados ni domingos. Esos días no están disponibles.',
        );
      }
    }

    const disponibleRaw = body.disponible ?? body.Disponible;
    const esDisponible =
      disponibleRaw === undefined || disponibleRaw === null
        ? true
        : Boolean(disponibleRaw);

    let horaInicio = String(body.horaInicio ?? body.HoraInicio ?? '').trim();
    let horaFin = String(body.horaFin ?? body.HoraFin ?? '').trim();

    if (!esDisponible) {
      horaInicio = '';
      horaFin = '';
    } else {
      if (!horaInicio) horaInicio = HORA_APERTURA_DEFAULT;
      if (!horaFin) horaFin = HORA_CIERRE_DEFAULT;
      if (!HORA_RE.test(horaInicio) || !HORA_RE.test(horaFin)) {
        throw new BadRequestException('Horas inválidas (use HH:mm).');
      }
      if (horaFin <= horaInicio) {
        throw new BadRequestException(
          'La hora de fin debe ser posterior a la de inicio.',
        );
      }
      const minA = horaAMinutos(HORA_APERTURA_DEFAULT);
      const minC = horaAMinutos(HORA_CIERRE_DEFAULT);
      const minI = horaAMinutos(horaInicio);
      const minF = horaAMinutos(horaFin);
      if (minI < minA || minF > minC) {
        throw new BadRequestException(
          `El horario especial debe estar entre ${HORA_APERTURA_DEFAULT} y ${HORA_CIERRE_DEFAULT}.`,
        );
      }
      if (horaInicio === HORA_APERTURA_DEFAULT && horaFin === HORA_CIERRE_DEFAULT) {
        throw new BadRequestException(
          `Para horario especial usá un rango distinto a ${HORA_APERTURA_DEFAULT}–${HORA_CIERRE_DEFAULT} (ese es el horario normal).`,
        );
      }
    }

    const nota = String(body.nota ?? body.Nota ?? '').trim().slice(0, 300);

    const out: Partial<DisponibilidadGrupo> = {};
    if (!parcial || body.tipo != null || body.Tipo != null) out.Tipo = tipo;
    if (!parcial || fechaRaw != null) out.Fecha = fecha;
    out.HoraInicio = horaInicio;
    out.HoraFin = horaFin;
    out.Disponible = esDisponible;
    out.CupoMaximo = null;
    if (!parcial || body.nota != null || body.Nota != null) out.Nota = nota;
    return out;
  }
}
