import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DonacionNecesidad } from '../entities/donacion-necesidad.entity';
import {
  DatosActualizarNecesidad,
  DatosNuevaNecesidad,
  INecesidadRepository,
} from './necesidad.repository.interface';

@Injectable()
export class NecesidadRepository implements INecesidadRepository {
  constructor(
    @InjectRepository(DonacionNecesidad)
    private readonly repo: Repository<DonacionNecesidad>,
  ) {}

  listarActivas(): Promise<DonacionNecesidad[]> {
    return this.repo
      .createQueryBuilder('n')
      .where('n.Estado = :estado', { estado: 'ACTIVA' })
      .andWhere('n.DeletedAt IS NULL')
      .orderBy(
        `CASE n.Prioridad WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END`,
        'ASC',
      )
      .addOrderBy('n.CreatedAt', 'DESC')
      .getMany();
  }

  listarTodas(): Promise<DonacionNecesidad[]> {
    return this.repo.find({
      withDeleted: true,
      order: { CreatedAt: 'DESC' },
    });
  }

  obtenerPorId(id: number): Promise<DonacionNecesidad | null> {
    return this.repo.findOne({ where: { Id: id }, withDeleted: true });
  }

  obtenerPorUuid(uuid: string): Promise<DonacionNecesidad | null> {
    return this.repo.findOne({ where: { Uuid: uuid }, withDeleted: true });
  }

  crear(datos: DatosNuevaNecesidad): Promise<DonacionNecesidad> {
    const row = this.repo.create({
      Titulo: datos.titulo,
      Descripcion: datos.descripcion,
      Prioridad: datos.prioridad,
      CantidadRequerida: datos.cantidadRequerida,
      Estado: 'ACTIVA',
    });
    return this.repo.save(row);
  }

  async actualizar(
    id: number,
    datos: DatosActualizarNecesidad,
  ): Promise<DonacionNecesidad | null> {
    const actual = await this.obtenerPorId(id);
    if (!actual) return null;
    if (datos.titulo !== undefined) actual.Titulo = datos.titulo;
    if (datos.descripcion !== undefined) actual.Descripcion = datos.descripcion;
    if (datos.prioridad !== undefined) actual.Prioridad = datos.prioridad;
    if (datos.cantidadRequerida !== undefined) {
      actual.CantidadRequerida = datos.cantidadRequerida;
    }
    if (datos.estado !== undefined) {
      actual.Estado = datos.estado;
      actual.DeletedAt = datos.estado === 'INACTIVA' ? new Date() : null;
    }
    return this.repo.save(actual);
  }

  async inactivar(id: number): Promise<DonacionNecesidad | null> {
    return this.actualizar(id, { estado: 'INACTIVA' });
  }
}
