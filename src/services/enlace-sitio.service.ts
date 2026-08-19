import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnlaceSitio } from '../entities/enlace-sitio.entity';

@Injectable()
export class EnlaceSitioService {
  constructor(
    @InjectRepository(EnlaceSitio)
    private readonly repo: Repository<EnlaceSitio>,
  ) {}

  async obtenerTodos(seccion?: string): Promise<EnlaceSitio[]> {
    const qb = this.repo.createQueryBuilder('e');
    if (seccion?.trim()) {
      qb.where('LOWER(e.Seccion) = LOWER(:seccion)', {
        seccion: seccion.trim(),
      });
    }
    return qb.orderBy('e.Orden', 'ASC').addOrderBy('e.Id', 'ASC').getMany();
  }

  async crear(request: {
    Etiqueta: string;
    Ruta: string;
    Seccion: string;
    Orden?: number;
    AbrirEnNuevaPestana: boolean;
  }): Promise<EnlaceSitio> {
    const maxOrden = await this.repo
      .createQueryBuilder('e')
      .select('MAX(e.Orden)', 'max')
      .getRawOne<{ max: number | null }>();
    const enlace = this.repo.create({
      Etiqueta: request.Etiqueta.trim(),
      Ruta: request.Ruta.trim(),
      Seccion: request.Seccion.trim(),
      Orden: request.Orden ?? (maxOrden?.max ?? 0) + 1,
      AbrirEnNuevaPestana: request.AbrirEnNuevaPestana,
    });
    return this.repo.save(enlace);
  }

  async actualizar(
    id: string,
    cambios: {
      Etiqueta?: string;
      Ruta?: string;
      Seccion?: string;
      Orden?: number;
      AbrirEnNuevaPestana?: boolean;
    },
  ): Promise<EnlaceSitio | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;
    if (cambios.Etiqueta?.trim()) actual.Etiqueta = cambios.Etiqueta.trim();
    if (cambios.Ruta?.trim()) actual.Ruta = cambios.Ruta.trim();
    if (cambios.Seccion?.trim()) actual.Seccion = cambios.Seccion.trim();
    if (cambios.Orden != null) actual.Orden = cambios.Orden;
    if (cambios.AbrirEnNuevaPestana != null) {
      actual.AbrirEnNuevaPestana = cambios.AbrirEnNuevaPestana;
    }
    return this.repo.save(actual);
  }

  async eliminar(id: string): Promise<boolean> {
    const enlace = await this.repo.findOne({ where: { Id: id } });
    if (!enlace) return false;
    await this.repo.remove(enlace);
    return true;
  }
}
