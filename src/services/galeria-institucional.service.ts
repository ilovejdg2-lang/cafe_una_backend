import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GaleriaInstitucionalItem } from '../entities/galeria-institucional-item.entity';
import {
  CategoriasService,
  TIPO_CATEGORIA_GALERIA,
} from './categorias.service';

@Injectable()
export class GaleriaInstitucionalService {
  constructor(
    @InjectRepository(GaleriaInstitucionalItem)
    private readonly repo: Repository<GaleriaInstitucionalItem>,
    private readonly categoriasService: CategoriasService,
  ) {}

  async obtenerTodos(): Promise<GaleriaInstitucionalItem[]> {
    return this.repo.find({ order: { Orden: 'ASC', Id: 'ASC' } });
  }

  async crear(request: {
    Title: string;
    Image: string;
    Categoria?: string;
    Orden?: number;
  }): Promise<GaleriaInstitucionalItem> {
    const maxOrden = await this.repo
      .createQueryBuilder('g')
      .select('MAX(g.Orden)', 'max')
      .getRawOne<{ max: number | null }>();
    const categoria = await this.resolverCategoria(request.Categoria);
    const item = this.repo.create({
      Title: request.Title.trim(),
      Image: request.Image.trim(),
      Categoria: categoria,
      Orden: request.Orden ?? (maxOrden?.max ?? 0) + 1,
    });
    return this.repo.save(item);
  }

  async actualizar(
    id: string,
    cambios: { Title?: string; Image?: string; Categoria?: string; Orden?: number },
  ): Promise<GaleriaInstitucionalItem | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;
    if (cambios.Title?.trim()) actual.Title = cambios.Title.trim();
    if (cambios.Image?.trim()) actual.Image = cambios.Image.trim();
    if (cambios.Categoria != null) {
      actual.Categoria = await this.resolverCategoria(cambios.Categoria);
    }
    if (cambios.Orden != null) actual.Orden = cambios.Orden;
    return this.repo.save(actual);
  }

  async eliminar(id: string): Promise<boolean> {
    const item = await this.repo.findOne({ where: { Id: id } });
    if (!item) return false;
    await this.repo.remove(item);
    return true;
  }

  private async resolverCategoria(categoria?: string): Promise<string> {
    const limpio = String(categoria || '').trim();
    if (!limpio) return '';
    return this.categoriasService.asegurar(limpio, TIPO_CATEGORIA_GALERIA);
  }
}
