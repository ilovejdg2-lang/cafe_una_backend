import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FechaRecepcionDonacion } from '../entities/fecha-recepcion-donacion.entity';

const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export const HORARIOS_RECEPCION_DONACION_PREDETERMINADOS = [
  '8:00 a. m. – 12:00 m.',
  '1:00 p. m. – 5:00 p. m.',
];

function normalizarFecha(fecha: string): string {
  const f = String(fecha || '').trim().slice(0, 10);
  if (!FECHA_ISO_RE.test(f)) {
    throw new BadRequestException('Formato de fecha inválido (use AAAA-MM-DD).');
  }
  return f;
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
export class FechasRecepcionDonacionService {
  constructor(
    @InjectRepository(FechaRecepcionDonacion)
    private readonly repo: Repository<FechaRecepcionDonacion>,
  ) {}

  async listarDisponibles(
    desde?: string,
    hasta?: string,
  ): Promise<FechaRecepcionDonacion[]> {
    const fechaInicio = desde && FECHA_ISO_RE.test(desde) ? desde : hoyIso();
    const qb = this.repo.createQueryBuilder('fr');

    qb.where('fr.Habilitada = :habilitada', { habilitada: true }).andWhere(
      'fr.Fecha >= :inicio',
      { inicio: fechaInicio },
    );

    if (hasta && FECHA_ISO_RE.test(hasta)) {
      qb.andWhere('fr.Fecha <= :hasta', { hasta });
    }

    return qb.orderBy('fr.Fecha', 'ASC').getMany();
  }

  async listarTodas(
    desde?: string,
    hasta?: string,
  ): Promise<FechaRecepcionDonacion[]> {
    const qb = this.repo.createQueryBuilder('fr');

    if (desde && FECHA_ISO_RE.test(desde)) {
      qb.andWhere('fr.Fecha >= :desde', { desde });
    }
    if (hasta && FECHA_ISO_RE.test(hasta)) {
      qb.andWhere('fr.Fecha <= :hasta', { hasta });
    }

    return qb.orderBy('fr.Fecha', 'ASC').getMany();
  }

  async habilitarFecha(
    fecha: string,
    horarios?: string[],
    observaciones?: string,
  ): Promise<FechaRecepcionDonacion> {
    const f = normalizarFecha(fecha);
    const hoy = hoyIso();

    if (f < hoy) {
      throw new BadRequestException('No se pueden habilitar fechas pasadas.');
    }

    const horariosNormalizados = normalizarHorarios(horarios);
    let registro = await this.repo.findOne({ where: { Fecha: f } });

    if (!registro) {
      registro = this.repo.create({
        Fecha: f,
        Habilitada: true,
        Horarios: horariosNormalizados,
        Observaciones: observaciones ? String(observaciones).trim() : '',
      });
    } else {
      registro.Habilitada = true;
      if (horarios !== undefined) registro.Horarios = horariosNormalizados;
      if (observaciones !== undefined) {
        registro.Observaciones = String(observaciones).trim();
      }
    }

    return this.repo.save(registro);
  }

  async actualizarEstado(
    fecha: string,
    habilitada: boolean,
    horarios?: string[],
    observaciones?: string,
  ): Promise<FechaRecepcionDonacion> {
    const f = normalizarFecha(fecha);
    const hoy = hoyIso();

    if (habilitada && f < hoy) {
      throw new BadRequestException('No se pueden habilitar fechas pasadas.');
    }

    const horariosNormalizados = normalizarHorarios(horarios);
    let registro = await this.repo.findOne({ where: { Fecha: f } });

    if (!registro) {
      registro = this.repo.create({
        Fecha: f,
        Habilitada: habilitada,
        Horarios: horariosNormalizados,
        Observaciones: observaciones ? String(observaciones).trim() : '',
      });
    } else {
      registro.Habilitada = habilitada;
      if (horarios !== undefined) registro.Horarios = horariosNormalizados;
      if (observaciones !== undefined) {
        registro.Observaciones = String(observaciones).trim();
      }
    }

    return this.repo.save(registro);
  }

  async toggleFecha(fecha: string): Promise<FechaRecepcionDonacion> {
    const f = normalizarFecha(fecha);
    const hoy = hoyIso();

    if (f < hoy) {
      throw new BadRequestException('No se pueden modificar fechas pasadas.');
    }

    let registro = await this.repo.findOne({ where: { Fecha: f } });

    if (!registro) {
      registro = this.repo.create({
        Fecha: f,
        Habilitada: true,
        Horarios: [...HORARIOS_RECEPCION_DONACION_PREDETERMINADOS],
      });
    } else {
      registro.Habilitada = !registro.Habilitada;
    }

    return this.repo.save(registro);
  }

  async eliminarFecha(fecha: string): Promise<void> {
    const f = normalizarFecha(fecha);
    const registro = await this.repo.findOne({ where: { Fecha: f } });
    if (!registro) {
      throw new NotFoundException(
        `La fecha de recepción ${f} no se encuentra registrada.`,
      );
    }
    await this.repo.remove(registro);
  }

  async estaFechaYHorarioHabilitada(
    fecha: string,
    horario?: string,
  ): Promise<{ valida: boolean; mensajeError?: string }> {
    const f = normalizarFecha(fecha);
    const hoy = hoyIso();

    if (f < hoy) {
      return {
        valida: false,
        mensajeError: 'No se pueden programar entregas en fechas pasadas.',
      };
    }

    const registro = await this.repo.findOne({
      where: { Fecha: f, Habilitada: true },
    });

    if (!registro) {
      return {
        valida: false,
        mensajeError: `La fecha ${f} no está habilitada para recibir donaciones en el centro de acopio.`,
      };
    }

    if (
      registro.Horarios &&
      Array.isArray(registro.Horarios) &&
      registro.Horarios.length > 0
    ) {
      const hTrim = String(horario || '').trim();
      if (!hTrim) {
        return {
          valida: false,
          mensajeError: 'Debe seleccionar un horario de recepción disponible.',
        };
      }
      const coincide = registro.Horarios.some(
        (h) => h.toLowerCase() === hTrim.toLowerCase(),
      );
      if (!coincide) {
        return {
          valida: false,
          mensajeError: `El horario "${horario}" no está disponible para recibir donaciones el ${f}.`,
        };
      }
    }

    return { valida: true };
  }
}
