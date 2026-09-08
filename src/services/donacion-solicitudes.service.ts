import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { pickString } from '../common/body-fields';
import { DonacionNecesidad } from '../entities/donacion-necesidad.entity';
import { DonacionSolicitud } from '../entities/donacion-solicitud.entity';

@Injectable()
export class DonacionSolicitudesService {
  constructor(
    @InjectRepository(DonacionSolicitud)
    private readonly solicitudes: Repository<DonacionSolicitud>,
    @InjectRepository(DonacionNecesidad)
    private readonly necesidades: Repository<DonacionNecesidad>,
  ) {}

  async crear(body: Record<string, unknown>, usuarioId: number) {
    if (!usuarioId) {
      throw new BadRequestException('Debe iniciar sesión para donar.');
    }
    const descripcion = pickString(body, 'descripcion', 'Descripcion').trim();
    const fechaPropuesta = pickString(
      body,
      'fechaPropuesta',
      'FechaPropuesta',
    ).trim();
    if (!descripcion) {
      throw new BadRequestException('La descripción es obligatoria.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPropuesta)) {
      throw new BadRequestException(
        'La fecha propuesta debe tener formato YYYY-MM-DD.',
      );
    }

    let tipo = pickString(body, 'tipo', 'Tipo').trim();
    let necesidadId: number | null = null;
    const necesidadRaw = String(
      body.necesidadId ?? body.NecesidadId ?? body.necesidadUuid ?? '',
    ).trim();
    if (necesidadRaw) {
      const necesidad = /^\d+$/.test(necesidadRaw)
        ? await this.necesidades.findOne({
            where: { Id: Number(necesidadRaw), Estado: 'ACTIVA' },
          })
        : await this.necesidades.findOne({
            where: { Uuid: necesidadRaw, Estado: 'ACTIVA' },
          });
      if (!necesidad) {
        throw new NotFoundException('La necesidad ya no está activa.');
      }
      necesidadId = necesidad.Id;
      if (!tipo) tipo = necesidad.Titulo;
    }
    if (!tipo) {
      throw new BadRequestException('El tipo de donación es obligatorio.');
    }

    const guardada = await this.solicitudes.save(
      this.solicitudes.create({
        UsuarioId: usuarioId,
        NecesidadId: necesidadId,
        Tipo: tipo.slice(0, 200),
        Descripcion: descripcion.slice(0, 2000),
        FechaPropuesta: fechaPropuesta,
        Estado: 'Pendiente',
      }),
    );
    return this.mapear(guardada);
  }

  async listarPropias(usuarioId: number) {
    const rows = await this.solicitudes.find({
      where: { UsuarioId: usuarioId },
      relations: ['Necesidad'],
      order: { CreatedAt: 'DESC' },
    });
    return rows.map((row) => this.mapear(row));
  }

  async listarAdmin() {
    const rows = await this.solicitudes.find({
      relations: ['Necesidad', 'Usuario'],
      order: { CreatedAt: 'DESC' },
    });
    return rows.map((row) => this.mapear(row, true));
  }

  private mapear(row: DonacionSolicitud, admin = false) {
    return {
      id: row.Id,
      tipo: row.Tipo,
      descripcion: row.Descripcion,
      fechaPropuesta:
        typeof row.FechaPropuesta === 'string'
          ? row.FechaPropuesta.slice(0, 10)
          : String(row.FechaPropuesta ?? '').slice(0, 10),
      estado: row.Estado,
      createdAt: row.CreatedAt,
      necesidadId: row.NecesidadId,
      necesidadTitulo: row.Necesidad?.Titulo ?? row.Tipo,
      ...(admin
        ? {
            usuarioId: row.UsuarioId,
            usuarioNombre: row.Usuario?.Nombre ?? '',
            usuarioCorreo: row.Usuario?.Correo ?? '',
          }
        : {}),
    };
  }
}
