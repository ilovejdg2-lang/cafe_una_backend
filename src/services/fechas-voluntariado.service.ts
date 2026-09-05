import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { FechaVoluntariado } from '../entities/fecha-voluntariado.entity';

const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizarFecha(fecha: string): string {
  const f = String(fecha || '').trim().slice(0, 10);
  if (!FECHA_ISO_RE.test(f)) {
    throw new BadRequestException('Formato de fecha inválido (use AAAA-MM-DD).');
  }
  return f;
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
   */
  async listarDisponibles(desde?: string, hasta?: string): Promise<FechaVoluntariado[]> {
    const fechaInicio = desde && FECHA_ISO_RE.test(desde) ? desde : hoyIso();
    const qb = this.repo.createQueryBuilder('fv');

    qb.where('fv.Habilitada = :habilitada', { habilitada: true })
      .andWhere('fv.Fecha >= :inicio', { inicio: fechaInicio });

    if (hasta && FECHA_ISO_RE.test(hasta)) {
      qb.andWhere('fv.Fecha <= :hasta', { hasta });
    }

    return qb.orderBy('fv.Fecha', 'ASC').getMany();
  }

  /**
   * Obtener todas las fechas registradas para el panel administrativo.
   */
  async listarTodas(desde?: string, hasta?: string): Promise<FechaVoluntariado[]> {
    const qb = this.repo.createQueryBuilder('fv');

    if (desde && FECHA_ISO_RE.test(desde)) {
      qb.andWhere('fv.Fecha >= :desde', { desde });
    }
    if (hasta && FECHA_ISO_RE.test(hasta)) {
      qb.andWhere('fv.Fecha <= :hasta', { hasta });
    }

    return qb.orderBy('fv.Fecha', 'ASC').getMany();
  }

  /**
   * Habilitar o crear una fecha disponible.
   */
  async habilitarFecha(
    fecha: string,
    cupoMaximo?: number | null,
    observaciones?: string,
  ): Promise<FechaVoluntariado> {
    const f = normalizarFecha(fecha);
    const hoy = hoyIso();

    if (f < hoy) {
      throw new BadRequestException('No se pueden habilitar fechas pasadas.');
    }

    let registro = await this.repo.findOne({ where: { Fecha: f } });
    if (!registro) {
      registro = this.repo.create({
        Fecha: f,
        Habilitada: true,
        CupoMaximo: cupoMaximo ?? null,
        Observaciones: observaciones ? String(observaciones).trim() : '',
      });
    } else {
      registro.Habilitada = true;
      if (cupoMaximo !== undefined) registro.CupoMaximo = cupoMaximo;
      if (observaciones !== undefined) registro.Observaciones = String(observaciones).trim();
    }

    return this.repo.save(registro);
  }

  /**
   * Deshabilitar una fecha existente o marcarla deshabilitada.
   */
  async deshabilitarFecha(fecha: string): Promise<FechaVoluntariado> {
    const f = normalizarFecha(fecha);
    let registro = await this.repo.findOne({ where: { Fecha: f } });

    if (!registro) {
      registro = this.repo.create({
        Fecha: f,
        Habilitada: false,
      });
    } else {
      registro.Habilitada = false;
    }

    return this.repo.save(registro);
  }

  /**
   * Alternar estado habilitado/deshabilitado de una fecha.
   */
  async toggleFecha(fecha: string): Promise<FechaVoluntariado> {
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
      });
    } else {
      registro.Habilitada = !registro.Habilitada;
    }

    return this.repo.save(registro);
  }

  /**
   * Actualizar estado específico de una fecha.
   */
  async actualizarEstado(
    fecha: string,
    habilitada: boolean,
    cupoMaximo?: number | null,
    observaciones?: string,
  ): Promise<FechaVoluntariado> {
    const f = normalizarFecha(fecha);
    const hoy = hoyIso();

    if (habilitada && f < hoy) {
      throw new BadRequestException('No se pueden habilitar fechas pasadas.');
    }

    let registro = await this.repo.findOne({ where: { Fecha: f } });
    if (!registro) {
      registro = this.repo.create({
        Fecha: f,
        Habilitada: habilitada,
        CupoMaximo: cupoMaximo ?? null,
        Observaciones: observaciones ? String(observaciones).trim() : '',
      });
    } else {
      registro.Habilitada = habilitada;
      if (cupoMaximo !== undefined) registro.CupoMaximo = cupoMaximo;
      if (observaciones !== undefined) registro.Observaciones = String(observaciones).trim();
    }

    return this.repo.save(registro);
  }

  /**
   * Eliminar registro de fecha.
   */
  async eliminarFecha(fecha: string): Promise<void> {
    const f = normalizarFecha(fecha);
    const registro = await this.repo.findOne({ where: { Fecha: f } });
    if (!registro) {
      throw new NotFoundException(`La fecha ${f} no se encuentra registrada.`);
    }
    await this.repo.remove(registro);
  }

  /**
   * Valida si una fecha específica está actualmente habilitada para recibir voluntarios.
   */
  async estaFechaHabilitada(fecha: string): Promise<boolean> {
    const f = normalizarFecha(fecha);
    const hoy = hoyIso();
    if (f < hoy) return false;

    const registro = await this.repo.findOne({
      where: { Fecha: f, Habilitada: true },
    });
    return !!registro;
  }
}
