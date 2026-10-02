import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';

import { DisponibilidadVisita } from '../entities/disponibilidad-visita.entity';
import { TurnoVisita } from '../entities/turno-visita.entity';
import { VisitaGrupal } from '../entities/visita-grupal.entity';

type FiltrosFecha = { desde?: string; hasta?: string };

export function formatearHora12(hora: string): string {
  const [hStr, mStr] = String(hora || '').slice(0, 5).split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return hora;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const m = mStr ? mStr.padStart(2, '0') : '00';
  return `${h}:${m} ${ampm}`;
}

function hoyLocal(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

function mapearDisponibilidad(row: DisponibilidadVisita) {
  return {
    id: row.Id,
    fecha: row.Fecha,
    horaInicio: row.HoraInicio,
    horaFin: row.HoraFin,
    habilitada: row.Habilitada,
    nota: row.Nota,
  };
}

@Injectable()
export class VisitasDisponibilidadService {
  constructor(
    @InjectRepository(DisponibilidadVisita)
    private readonly repo: Repository<DisponibilidadVisita>,
    @Optional()
    @InjectRepository(TurnoVisita)
    private readonly turnosRepo?: Repository<TurnoVisita>,
    @Optional()
    @InjectRepository(VisitaGrupal)
    private readonly visitasRepo?: Repository<VisitaGrupal>,
  ) {}

  async listarPublicas(filtros: FiltrosFecha) {
    const { desde, hasta } = this.validarFiltros(filtros);
    const fechaMinima = desde && desde > hoyLocal() ? desde : hoyLocal();
    const qb = this.repo.createQueryBuilder('d');
    qb.andWhere('d.Habilitada = true');
    qb.andWhere('d.Fecha >= :desde', { desde: fechaMinima });
    if (hasta) qb.andWhere('d.Fecha <= :hasta', { hasta });
    return (await this.ordenar(qb).getMany()).map(mapearDisponibilidad);
  }

  async listarAdmin(filtros: FiltrosFecha) {
    const { desde, hasta } = this.validarFiltros(filtros);
    const qb = this.repo.createQueryBuilder('d');
    if (desde) qb.andWhere('d.Fecha >= :desde', { desde });
    if (hasta) qb.andWhere('d.Fecha <= :hasta', { hasta });
    return (await this.ordenar(qb).getMany()).map(mapearDisponibilidad);
  }

  async crear(body: Record<string, unknown>) {
    const datos = this.leerAlta(body);
    await this.validarColision(datos);
    return mapearDisponibilidad(await this.repo.save(this.repo.create(datos)));
  }

  async actualizar(idRaw: string, body: Record<string, unknown>) {
    const id = this.validarId(idRaw);
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) {
      throw new NotFoundException('La disponibilidad de visita no existe.');
    }

    const cambios = this.leerCambio(body);
    const cambiaHorario =
      cambios.Fecha !== undefined ||
      cambios.HoraInicio !== undefined ||
      cambios.HoraFin !== undefined;
    const final = { ...actual, ...cambios };
    if (cambiaHorario) {
      this.validarLimites(final.Fecha, final.HoraInicio, final.HoraFin);
      await this.validarColision(final, id);
    }

    Object.assign(actual, cambios);
    return mapearDisponibilidad(await this.repo.save(actual));
  }

  private ordenar(
    qb: ReturnType<Repository<DisponibilidadVisita>['createQueryBuilder']>,
  ) {
    return qb.orderBy('d.Fecha', 'ASC').addOrderBy('d.HoraInicio', 'ASC');
  }

  private validarFiltros(filtros: FiltrosFecha) {
    const desde = filtros.desde?.trim() || undefined;
    const hasta = filtros.hasta?.trim() || undefined;
    if (desde) this.validarFecha(desde);
    if (hasta) this.validarFecha(hasta);
    if (desde && hasta && hasta < desde) {
      throw new BadRequestException(
        'La fecha hasta no puede ser anterior a la fecha desde.',
      );
    }
    return { desde, hasta };
  }

  async obtenerFranjasPorFecha(fechaRaw: string) {
    const fecha = String(fechaRaw || '').trim();
    this.validarFecha(fecha);

    const slots = await this.repo.find({
      where: { Fecha: fecha, Habilitada: true },
      order: { HoraInicio: 'ASC' },
    });

    const franjas = [];
    for (const slot of slots) {
      let ocupado = 0;
      if (this.visitasRepo) {
        const query = await this.visitasRepo
          .createQueryBuilder('v')
          .where('v.DisponibilidadVisitaId = :id', { id: slot.Id })
          .andWhere('v.Estado NOT IN (:...estadosExcluidos)', {
            estadosExcluidos: ['Rechazada', 'Inactiva'],
          })
          .select('COALESCE(SUM(v.CantidadVisitantes), 0)', 'total')
          .getRawOne();
        ocupado = Number(query?.total ?? 0);
      }

      const capacidadMaxima = Number(slot.CapacidadMaxima ?? 30);
      const cupoRestante = Math.max(0, capacidadMaxima - ocupado);
      const agotada = cupoRestante <= 0;
      const inicio12 = formatearHora12(slot.HoraInicio);
      const fin12 = formatearHora12(slot.HoraFin);

      franjas.push({
        id: slot.Id,
        fecha: slot.Fecha,
        horaInicio: slot.HoraInicio,
        horaFin: slot.HoraFin,
        horaInicioFormato: inicio12,
        horaFinFormato: fin12,
        franja: `${inicio12} - ${fin12}`,
        capacidadMaxima,
        cupoOcupado: ocupado,
        cupoRestante,
        agotada,
        habilitada: slot.Habilitada && !agotada,
        nota: slot.Nota,
      });
    }

    return franjas;
  }

  async listarTurnosParametrizados() {
    if (!this.turnosRepo) return [];
    return this.turnosRepo.find({
      order: { HoraInicio: 'ASC' },
    });
  }

  async crearTurnoParametrizado(body: Record<string, unknown>) {
    if (!this.turnosRepo) {
      throw new BadRequestException('El módulo de turnos no está disponible.');
    }
    const HoraInicio = this.validarHora(
      this.texto(body, 'horaInicio', 'HoraInicio'),
    );
    const HoraFin = this.validarHora(
      this.texto(body, 'horaFin', 'HoraFin'),
    );
    if (HoraFin <= HoraInicio) {
      throw new BadRequestException(
        'La hora final debe ser posterior a la hora inicial.',
      );
    }
    const capacidadRaw = body.capacidadMaxima ?? body.CapacidadMaxima ?? 30;
    const CapacidadMaxima = Math.max(1, Number(capacidadRaw) || 30);
    const Habilitado = this.booleano(body, 'habilitado', 'Habilitado', true);
    const Nota = this.nota(body, 'nota', 'Nota');

    const nuevo = this.turnosRepo.create({
      HoraInicio,
      HoraFin,
      CapacidadMaxima,
      Habilitado,
      Nota,
    });
    return this.turnosRepo.save(nuevo);
  }

  async actualizarTurnoParametrizado(
    idRaw: string,
    body: Record<string, unknown>,
  ) {
    if (!this.turnosRepo) {
      throw new BadRequestException('El módulo de turnos no está disponible.');
    }
    const id = this.validarId(idRaw);
    const actual = await this.turnosRepo.findOne({ where: { Id: id } });
    if (!actual) {
      throw new NotFoundException('El turno parametrizado no existe.');
    }

    if (this.tiene(body, 'horaInicio', 'HoraInicio')) {
      actual.HoraInicio = this.validarHora(
        this.texto(body, 'horaInicio', 'HoraInicio'),
      );
    }
    if (this.tiene(body, 'horaFin', 'HoraFin')) {
      actual.HoraFin = this.validarHora(
        this.texto(body, 'horaFin', 'HoraFin'),
      );
    }
    if (actual.HoraFin <= actual.HoraInicio) {
      throw new BadRequestException(
        'La hora final debe ser posterior a la hora inicial.',
      );
    }
    if (this.tiene(body, 'capacidadMaxima', 'CapacidadMaxima')) {
      const capRaw = body.capacidadMaxima ?? body.CapacidadMaxima;
      actual.CapacidadMaxima = Math.max(1, Number(capRaw) || 30);
    }
    if (this.tiene(body, 'habilitado', 'Habilitado')) {
      actual.Habilitado = this.booleano(
        body,
        'habilitado',
        'Habilitado',
        true,
      );
    }
    if (this.tiene(body, 'nota', 'Nota')) {
      actual.Nota = this.nota(body, 'nota', 'Nota');
    }

    return this.turnosRepo.save(actual);
  }

  private leerAlta(body: Record<string, unknown>) {
    const Fecha = this.texto(body, 'fecha', 'Fecha');
    const HoraInicio = this.validarHora(
      this.texto(body, 'horaInicio', 'HoraInicio'),
    );
    const HoraFin = this.validarHora(this.texto(body, 'horaFin', 'HoraFin'));
    this.validarLimites(Fecha, HoraInicio, HoraFin);
    const capacidadRaw = body.capacidadMaxima ?? body.CapacidadMaxima ?? 30;
    const CapacidadMaxima = Math.max(1, Number(capacidadRaw) || 30);

    return {
      Fecha,
      HoraInicio,
      HoraFin,
      Habilitada: this.booleano(body, 'habilitada', 'Habilitada', true),
      CapacidadMaxima,
      Nota: this.nota(body, 'nota', 'Nota'),
    };
  }

  private leerCambio(body: Record<string, unknown>) {
    const cambios: Partial<DisponibilidadVisita> = {};
    if (this.tiene(body, 'fecha', 'Fecha')) {
      cambios.Fecha = this.texto(body, 'fecha', 'Fecha');
      this.validarFecha(cambios.Fecha);
    }
    if (this.tiene(body, 'horaInicio', 'HoraInicio')) {
      cambios.HoraInicio = this.validarHora(
        this.texto(body, 'horaInicio', 'HoraInicio'),
      );
    }
    if (this.tiene(body, 'horaFin', 'HoraFin')) {
      cambios.HoraFin = this.validarHora(
        this.texto(body, 'horaFin', 'HoraFin'),
      );
    }
    if (this.tiene(body, 'habilitada', 'Habilitada')) {
      cambios.Habilitada = this.booleano(
        body,
        'habilitada',
        'Habilitada',
        false,
      );
    }
    if (this.tiene(body, 'capacidadMaxima', 'CapacidadMaxima')) {
      const capRaw = body.capacidadMaxima ?? body.CapacidadMaxima;
      cambios.CapacidadMaxima = Math.max(1, Number(capRaw) || 30);
    }
    if (this.tiene(body, 'nota', 'Nota')) {
      cambios.Nota = this.nota(body, 'nota', 'Nota');
    }
    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException('No se recibieron cambios válidos.');
    }
    return cambios;
  }

  private async validarColision(
    datos: Pick<DisponibilidadVisita, 'Fecha' | 'HoraInicio' | 'HoraFin'>,
    excluirId?: string,
  ) {
    const excluir = excluirId ? { Id: Not(excluirId) } : {};
    const duplicado = await this.repo.findOne({
      where: {
        ...excluir,
        Fecha: datos.Fecha,
        HoraInicio: datos.HoraInicio,
        HoraFin: datos.HoraFin,
      },
    });
    if (duplicado) {
      throw new BadRequestException('El horario de visita está duplicado.');
    }
    const traslape = await this.repo.findOne({
      where: {
        ...excluir,
        Fecha: datos.Fecha,
        HoraInicio: LessThan(datos.HoraFin),
        HoraFin: MoreThan(datos.HoraInicio),
      },
    });
    if (traslape) {
      throw new BadRequestException(
        'El horario de visita se traslapa con otro existente.',
      );
    }
  }

  private validarLimites(fecha: string, inicio: string, fin: string) {
    this.validarFecha(fecha);
    if (fecha < hoyLocal()) {
      throw new BadRequestException(
        'La fecha de visita no puede estar en el pasado.',
      );
    }
    if (fin <= inicio) {
      throw new BadRequestException(
        'La hora final debe ser posterior a la hora inicial.',
      );
    }
  }

  private validarFecha(fecha: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException(
        'La fecha debe usar el formato YYYY-MM-DD.',
      );
    }
    const date = new Date(`${fecha}T00:00:00Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== fecha
    ) {
      throw new BadRequestException('La fecha no es válida.');
    }
  }

  private validarHora(hora: string) {
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hora);
    if (
      !match ||
      Number(match[1]) > 23 ||
      Number(match[2]) > 59 ||
      Number(match[3] ?? 0) > 59
    ) {
      throw new BadRequestException('La hora debe usar el formato HH:mm.');
    }
    return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;
  }

  private validarId(raw: string) {
    const id = String(raw ?? '').trim();
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('El identificador no es válido.');
    }
    return id;
  }

  private texto(body: Record<string, unknown>, camel: string, pascal: string) {
    const value = body[camel] ?? body[pascal];
    return typeof value === 'string' ? value.trim() : '';
  }

  private tiene(body: Record<string, unknown>, camel: string, pascal: string) {
    return (
      Object.prototype.hasOwnProperty.call(body, camel) ||
      Object.prototype.hasOwnProperty.call(body, pascal)
    );
  }

  private nota(body: Record<string, unknown>, camel: string, pascal: string) {
    const value = this.texto(body, camel, pascal);
    if (value.length > 500) {
      throw new BadRequestException('La nota no puede superar 500 caracteres.');
    }
    return value || null;
  }

  private booleano(
    body: Record<string, unknown>,
    camel: string,
    pascal: string,
    defaultValue: boolean,
  ) {
    const value = body[camel] ?? body[pascal];
    if (value === undefined) return defaultValue;
    if (typeof value !== 'boolean') {
      throw new BadRequestException('El estado habilitado debe ser booleano.');
    }
    return value;
  }
}
