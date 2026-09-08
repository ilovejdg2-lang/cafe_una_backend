import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pickString } from '../common/body-fields';
import {
  ESTADOS_NECESIDAD,
  PRIORIDADES_NECESIDAD,
  PrioridadNecesidad,
} from '../entities/donacion-necesidad.entity';
import type {
  INecesidadRepository,
} from '../repositories/necesidad.repository.interface';
import { NECESIDAD_REPOSITORY } from '../repositories/necesidad.repository.interface';

function mapearNecesidad(row: {
  Id: number;
  Uuid: string;
  Titulo: string;
  Descripcion: string;
  Prioridad: string;
  CantidadRequerida: number | null;
  Estado: string;
  CreatedAt: Date;
  UpdatedAt: Date;
  DeletedAt: Date | null;
}) {
  return {
    id: row.Id,
    uuid: row.Uuid,
    titulo: row.Titulo,
    descripcion: row.Descripcion,
    prioridad: row.Prioridad,
    cantidadRequerida: row.CantidadRequerida,
    estado: row.Estado,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

@Injectable()
export class NecesidadesService {
  constructor(
    @Inject(NECESIDAD_REPOSITORY)
    private readonly necesidades: INecesidadRepository,
  ) {}

  async listarPublicas() {
    const rows = await this.necesidades.listarActivas();
    return rows.map(mapearNecesidad);
  }

  async listarAdmin() {
    const rows = await this.necesidades.listarTodas();
    return rows.map(mapearNecesidad);
  }

  async crear(body: Record<string, unknown>) {
    return mapearNecesidad(await this.necesidades.crear(this.leerAlta(body)));
  }

  async actualizar(idRaw: string, body: Record<string, unknown>) {
    const id = this.parsearId(idRaw);
    const actual = await this.necesidades.actualizar(id, this.leerCambio(body));
    if (!actual) throw new NotFoundException('La necesidad no existe.');
    return mapearNecesidad(actual);
  }

  async inactivar(idRaw: string) {
    const id = this.parsearId(idRaw);
    const actual = await this.necesidades.inactivar(id);
    if (!actual) throw new NotFoundException('La necesidad no existe.');
    return mapearNecesidad(actual);
  }

  private parsearId(raw: string): number {
    if (!/^\d+$/.test(String(raw ?? '').trim())) {
      throw new BadRequestException('El identificador no es válido.');
    }
    return Number(raw);
  }

  private leerAlta(body: Record<string, unknown>) {
    const titulo = pickString(body, 'titulo', 'Titulo').trim();
    const descripcion = pickString(body, 'descripcion', 'Descripcion').trim();
    if (!titulo) throw new BadRequestException('El título es obligatorio.');
    if (!descripcion) {
      throw new BadRequestException('La descripción es obligatoria.');
    }
    if (titulo.length > 200) {
      throw new BadRequestException('El título no puede superar 200 caracteres.');
    }
    if (descripcion.length > 2000) {
      throw new BadRequestException(
        'La descripción no puede superar 2000 caracteres.',
      );
    }
    return {
      titulo,
      descripcion,
      prioridad: this.leerPrioridad(body, true) as PrioridadNecesidad,
      cantidadRequerida: this.leerCantidad(body),
    };
  }

  private leerCambio(body: Record<string, unknown>) {
    const tituloRaw = pickString(body, 'titulo', 'Titulo');
    const descripcionRaw = pickString(body, 'descripcion', 'Descripcion');
    const estadoRaw = pickString(body, 'estado', 'Estado').trim().toUpperCase();
    const datos: {
      titulo?: string;
      descripcion?: string;
      prioridad?: PrioridadNecesidad;
      cantidadRequerida?: number | null;
      estado?: (typeof ESTADOS_NECESIDAD)[number];
    } = {};
    if (tituloRaw.trim()) datos.titulo = tituloRaw.trim();
    if (descripcionRaw.trim()) datos.descripcion = descripcionRaw.trim();
    const prioridad = this.leerPrioridad(body, false);
    if (prioridad) datos.prioridad = prioridad;
    if (
      Object.prototype.hasOwnProperty.call(body, 'cantidadRequerida') ||
      Object.prototype.hasOwnProperty.call(body, 'CantidadRequerida')
    ) {
      datos.cantidadRequerida = this.leerCantidad(body);
    }
    if (estadoRaw) {
      if (!ESTADOS_NECESIDAD.includes(estadoRaw as (typeof ESTADOS_NECESIDAD)[number])) {
        throw new BadRequestException('El estado debe ser ACTIVA o INACTIVA.');
      }
      datos.estado = estadoRaw as (typeof ESTADOS_NECESIDAD)[number];
    }
    return datos;
  }

  private leerPrioridad(
    body: Record<string, unknown>,
    obligatorio: boolean,
  ): PrioridadNecesidad | undefined {
    const raw = pickString(body, 'prioridad', 'Prioridad').trim().toUpperCase();
    if (!raw) {
      if (obligatorio) {
        throw new BadRequestException('La prioridad es obligatoria.');
      }
      return undefined;
    }
    if (!PRIORIDADES_NECESIDAD.includes(raw as PrioridadNecesidad)) {
      throw new BadRequestException('La prioridad debe ser ALTA, MEDIA o BAJA.');
    }
    return raw as PrioridadNecesidad;
  }

  private leerCantidad(body: Record<string, unknown>): number | null {
    const raw = body.cantidadRequerida ?? body.CantidadRequerida;
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      throw new BadRequestException(
        'La cantidad requerida debe ser un entero mayor a 0.',
      );
    }
    return n;
  }
}
