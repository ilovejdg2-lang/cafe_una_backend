import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GaleriaInstitucionalItem } from '../entities/galeria-institucional-item.entity';

@Injectable()
export class GaleriaInstitucionalService {
  constructor(
    @InjectRepository(GaleriaInstitucionalItem)
    private readonly repo: Repository<GaleriaInstitucionalItem>,
  ) {}

  async obtenerTodos(): Promise<GaleriaInstitucionalItem[]> {
    return this.repo.find({ order: { Orden: 'ASC', Id: 'ASC' } });
  }

  async crear(request: {
    Title: string;
    Image: string;
    Orden?: number;
  }): Promise<GaleriaInstitucionalItem> {
    const maxOrden = await this.repo
      .createQueryBuilder('g')
      .select('MAX(g.Orden)', 'max')
      .getRawOne<{ max: number | null }>();
    const item = this.repo.create({
      Title: request.Title.trim(),
      Image: request.Image.trim(),
      Orden: request.Orden ?? (maxOrden?.max ?? 0) + 1,
    });
    return this.repo.save(item);
  }

  async actualizar(
    id: string,
    cambios: { Title?: string; Image?: string; Orden?: number },
  ): Promise<GaleriaInstitucionalItem | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;
    if (cambios.Title?.trim()) actual.Title = cambios.Title.trim();
    if (cambios.Image?.trim()) actual.Image = cambios.Image.trim();
    if (cambios.Orden != null) actual.Orden = cambios.Orden;
    return this.repo.save(actual);
  }

  async eliminar(id: string): Promise<boolean> {
    const item = await this.repo.findOne({ where: { Id: id } });
    if (!item) return false;
    await this.repo.remove(item);
    return true;
  }
}
