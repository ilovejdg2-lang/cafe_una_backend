import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '../entities/categoria.entity';
import { GaleriaInstitucionalItem } from '../entities/galeria-institucional-item.entity';
import { Producto } from '../entities/producto.entity';

export const TIPO_CATEGORIA_PRODUCTO = 'producto';
export const TIPO_CATEGORIA_GALERIA = 'galeria';

const TIPOS = new Set([TIPO_CATEGORIA_PRODUCTO, TIPO_CATEGORIA_GALERIA]);

type CategoriaConUsos = {
  Id: string;
  Nombre: string;
  Tipo: string;
  Padre: string;
  Usos: number;
};

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly repo: Repository<Categoria>,
    @InjectRepository(Producto)
    private readonly productosRepo: Repository<Producto>,
    @InjectRepository(GaleriaInstitucionalItem)
    private readonly galeriaRepo: Repository<GaleriaInstitucionalItem>,
  ) {}

  normalizarTipo(tipo?: string): string {
    const valor = String(tipo || '').trim().toLowerCase();
    if (!TIPOS.has(valor)) {
      throw new BadRequestException('El tipo de categoría debe ser producto o galería.');
    }
    return valor;
  }

  normalizarNombre(nombre?: string): string {
    return String(nombre || '').trim();
  }

  normalizarPadre(padre?: string): string {
    return String(padre || '').trim();
  }

  async listar(tipo?: string, padre?: string): Promise<CategoriaConUsos[]> {
    const where: { Tipo?: string; Padre?: string } = {};
    if (tipo) where.Tipo = this.normalizarTipo(tipo);
    if (padre !== undefined) where.Padre = this.normalizarPadre(padre);

    const lista = await this.repo.find({
      where: Object.keys(where).length ? where : undefined,
      order: { Padre: 'ASC', Nombre: 'ASC' },
    });

    return Promise.all(
      lista.map(async (item) => ({
        Id: item.Id,
        Nombre: item.Nombre,
        Tipo: item.Tipo,
        Padre: item.Padre || '',
        Usos: await this.contarUsos(item.Nombre, item.Tipo, item.Padre || ''),
      })),
    );
  }

  async asegurar(nombre: string, tipo: string, padre = ''): Promise<string> {
    const limpio = this.normalizarNombre(nombre);
    const tipoNormalizado = this.normalizarTipo(tipo);
    const padreLimpio = this.normalizarPadre(padre);
    if (!limpio) return '';

    if (padreLimpio) {
      await this.asegurar(padreLimpio, tipoNormalizado, '');
    }

    const existente = await this.repo.findOne({
      where: { Nombre: limpio, Tipo: tipoNormalizado, Padre: padreLimpio },
    });
    if (existente) return existente.Nombre;

    const creado = this.repo.create({
      Nombre: limpio,
      Descripcion: '',
      Tipo: tipoNormalizado,
      Padre: padreLimpio,
    });
    const guardado = await this.repo.save(creado);
    return guardado.Nombre;
  }

  async crear(nombre: string, tipo: string, padre = ''): Promise<Categoria> {
    const limpio = this.normalizarNombre(nombre);
    if (!limpio) {
      throw new BadRequestException('Ingrese el nombre de la categoría.');
    }
    const tipoNormalizado = this.normalizarTipo(tipo);
    const padreLimpio = this.normalizarPadre(padre);

    if (padreLimpio) {
      const padreExiste = await this.repo.findOne({
        where: { Nombre: padreLimpio, Tipo: tipoNormalizado, Padre: '' },
      });
      if (!padreExiste) {
        throw new BadRequestException(
          'La categoría padre no existe. Créela primero.',
        );
      }
    }

    const existente = await this.repo.findOne({
      where: { Nombre: limpio, Tipo: tipoNormalizado, Padre: padreLimpio },
    });
    if (existente) return existente;

    return this.repo.save(
      this.repo.create({
        Nombre: limpio,
        Descripcion: '',
        Tipo: tipoNormalizado,
        Padre: padreLimpio,
      }),
    );
  }

  async eliminar(id: string): Promise<boolean> {
    const item = await this.repo.findOne({ where: { Id: id } });
    if (!item) return false;

    const padre = item.Padre || '';
    if (!padre) {
      const hijas = await this.repo.count({
        where: { Tipo: item.Tipo, Padre: item.Nombre },
      });
      if (hijas > 0) {
        throw new ConflictException(
          'No se puede borrar: tiene subcategorías asociadas.',
        );
      }
    }

    const usos = await this.contarUsos(item.Nombre, item.Tipo, padre);
    if (usos > 0) {
      throw new ConflictException(
        item.Tipo === TIPO_CATEGORIA_GALERIA
          ? 'No se puede borrar: hay fotos de la galería con esta categoría.'
          : padre
            ? 'No se puede borrar: hay productos con esta subcategoría.'
            : 'No se puede borrar: hay productos con esta categoría.',
      );
    }

    await this.repo.remove(item);
    return true;
  }

  private async contarUsos(
    nombre: string,
    tipo: string,
    padre: string,
  ): Promise<number> {
    if (tipo === TIPO_CATEGORIA_GALERIA) {
      return this.galeriaRepo
        .createQueryBuilder('item')
        .where('LOWER(item.Categoria) = LOWER(:nombre)', { nombre })
        .getCount();
    }

    if (padre) {
      return this.productosRepo
        .createQueryBuilder('item')
        .where('LOWER(item.Categoria) = LOWER(:padre)', { padre })
        .andWhere('LOWER(item.Subcategoria) = LOWER(:nombre)', { nombre })
        .getCount();
    }

    return this.productosRepo
      .createQueryBuilder('item')
      .where('LOWER(item.Categoria) = LOWER(:nombre)', { nombre })
      .getCount();
  }
}
