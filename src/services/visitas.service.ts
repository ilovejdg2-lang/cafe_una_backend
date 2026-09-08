import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VisitaGrupal } from '../entities/visita-grupal.entity';

@Injectable()
export class VisitasService {
  constructor(
    @InjectRepository(VisitaGrupal)
    private readonly repo: Repository<VisitaGrupal>,
  ) {}

  async crear(datos: Partial<VisitaGrupal>): Promise<VisitaGrupal> {
    const cantidad = Number(datos.CantidadVisitantes) || 0;
    if (cantidad < 2) {
      throw new BadRequestException(
        'La solicitud de visita es exclusivamente para grupos (mínimo 2 personas incluyendo al encargado).',
      );
    }

    const tipoVisitante = String(datos.TipoVisitante || 'Nacional').trim();
    if (
      tipoVisitante.toLowerCase() === 'internacional' &&
      !datos.PaisProcedencia?.trim()
    ) {
      throw new BadRequestException(
        'El país de procedencia es obligatorio para visitantes internacionales.',
      );
    }

    if (
      !datos.EncargadoNombre?.trim() ||
      !datos.EncargadoEmail?.trim() ||
      !datos.EncargadoTelefono?.trim()
    ) {
      throw new BadRequestException(
        'Los datos del encargado (nombre, correo y teléfono) son obligatorios.',
      );
    }

    if (!datos.FechaVisita?.trim() || !datos.HoraPreferida?.trim()) {
      throw new BadRequestException(
        'La fecha solicitada y el bloque de hora son obligatorios.',
      );
    }

    const hoy = new Date();
    const fechaSolicitud = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    const entidad = this.repo.create({
      ...datos,
      FechaSolicitud: datos.FechaSolicitud || fechaSolicitud,
      Estado: 'Pendiente',
      TipoVisitante: tipoVisitante,
      CantidadVisitantes: cantidad,
    });

    return this.repo.save(entidad);
  }

  async obtenerSolicitudes(filtros: {
    estado?: string;
    tipoVisitante?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    busqueda?: string;
  }): Promise<VisitaGrupal[]> {
    const qb = this.repo.createQueryBuilder('v');

    if (filtros.estado?.trim()) {
      qb.andWhere('LOWER(v.Estado) = LOWER(:estado)', {
        estado: filtros.estado.trim(),
      });
    }

    if (filtros.tipoVisitante?.trim()) {
      qb.andWhere('LOWER(v.TipoVisitante) = LOWER(:tipoVisitante)', {
        tipoVisitante: filtros.tipoVisitante.trim(),
      });
    }

    if (filtros.fechaDesde?.trim()) {
      qb.andWhere('v.FechaVisita >= :fechaDesde', {
        fechaDesde: filtros.fechaDesde.trim(),
      });
    }

    if (filtros.fechaHasta?.trim()) {
      qb.andWhere('v.FechaVisita <= :fechaHasta', {
        fechaHasta: filtros.fechaHasta.trim(),
      });
    }

    if (filtros.busqueda?.trim()) {
      const q = `%${filtros.busqueda.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(v.EncargadoNombre) LIKE :q OR LOWER(v.EncargadoEmail) LIKE :q OR LOWER(v.EncargadoIdentificacion) LIKE :q OR LOWER(v.CiudadProvincia) LIKE :q OR LOWER(v.PaisProcedencia) LIKE :q)',
        { q },
      );
    }

    return qb.orderBy('v.Id', 'DESC').getMany();
  }

  async obtenerSolicitudesDeUsuario(userId: string): Promise<VisitaGrupal[]> {
    return this.repo.find({
      where: { UserId: userId },
      order: { Id: 'DESC' },
    });
  }

  async obtenerPorId(id: string): Promise<VisitaGrupal | null> {
    return this.repo.findOne({ where: { Id: id } });
  }

  async actualizar(
    id: string,
    cambios: Record<string, unknown>,
  ): Promise<VisitaGrupal> {
    const existente = await this.obtenerPorId(id);
    if (!existente) {
      throw new NotFoundException(
        'No se encontró la solicitud de visita grupal.',
      );
    }

    Object.assign(existente, cambios);
    return this.repo.save(existente);
  }

  async eliminar(id: string): Promise<boolean> {
    const existente = await this.obtenerPorId(id);
    if (!existente) {
      return false;
    }

    existente.Estado = 'Inactiva';
    await this.repo.save(existente);
    return true;
  }
}
