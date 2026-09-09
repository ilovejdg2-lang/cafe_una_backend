import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';

import { DisponibilidadVisita } from '../entities/disponibilidad-visita.entity';

type FiltrosFecha = { desde?: string; hasta?: string };

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

  private leerAlta(body: Record<string, unknown>) {
    const Fecha = this.texto(body, 'fecha', 'Fecha');
    const HoraInicio = this.validarHora(
      this.texto(body, 'horaInicio', 'HoraInicio'),
    );
    const HoraFin = this.validarHora(this.texto(body, 'horaFin', 'HoraFin'));
    this.validarLimites(Fecha, HoraInicio, HoraFin);
    return {
      Fecha,
      HoraInicio,
      HoraFin,
      Habilitada: this.booleano(body, 'habilitada', 'Habilitada', true),
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
