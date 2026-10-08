import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '../entities/categoria.entity';
import { Documento } from '../entities/documento.entity';
import { GaleriaInstitucionalItem } from '../entities/galeria-institucional-item.entity';
import { Producto } from '../entities/producto.entity';

export const TIPO_CATEGORIA_PRODUCTO = 'producto';
export const TIPO_CATEGORIA_GALERIA = 'galeria';
export const TIPO_CATEGORIA_DOCUMENTO = 'documento';

const TIPOS = new Set([
  TIPO_CATEGORIA_PRODUCTO,
  TIPO_CATEGORIA_GALERIA,
  TIPO_CATEGORIA_DOCUMENTO,
]);

type CategoriaConUsos = {
  Id: string;
  Nombre: string;
  Tipo: string;
  Padre: string;
  Icono: string;
  Usos: number;
};

const ICONO_VALIDO = /^[a-z0-9-]{0,60}$/;

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly repo: Repository<Categoria>,
    @InjectRepository(Producto)
    private readonly productosRepo: Repository<Producto>,
    @InjectRepository(GaleriaInstitucionalItem)
    private readonly galeriaRepo: Repository<GaleriaInstitucionalItem>,
    @InjectRepository(Documento)
    private readonly documentosRepo: Repository<Documento>,
  ) {}

  normalizarTipo(tipo?: string): string {
    const valor = String(tipo || '').trim().toLowerCase();
    if (!TIPOS.has(valor)) {
      throw new BadRequestException(
        'El tipo de categoría debe ser producto, galería o documento.',
      );
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
    const qb = this.repo.createQueryBuilder('c');
    if (tipo) {
      qb.andWhere('c.Tipo = :tipo', { tipo: this.normalizarTipo(tipo) });
    }
    if (padre !== undefined) {
      const p = this.normalizarPadre(padre);
      if (p) {
        qb.andWhere('LOWER(c.Padre) = LOWER(:padre)', { padre: p });
      } else {
        qb.andWhere("(c.Padre = '' OR c.Padre IS NULL)");
      }
    }
    qb.orderBy('c.Padre', 'ASC').addOrderBy('c.Nombre', 'ASC');

    const lista = await qb.getMany();

    return Promise.all(
      lista.map(async (item) => ({
        Id: item.Id,
        Nombre: item.Nombre,
        Tipo: item.Tipo,
        Padre: item.Padre || '',
        Icono: item.Icono || '',
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

    const qb = this.repo
      .createQueryBuilder('c')
      .where('LOWER(c.Nombre) = LOWER(:nombre)', { nombre: limpio })
      .andWhere('c.Tipo = :tipo', { tipo: tipoNormalizado });

    if (padreLimpio) {
      qb.andWhere('LOWER(c.Padre) = LOWER(:padre)', { padre: padreLimpio });
    } else {
      qb.andWhere("(c.Padre = '' OR c.Padre IS NULL)");
    }

    const existente = await qb.getOne();
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
      const padreExiste = await this.repo
        .createQueryBuilder('c')
        .where('LOWER(c.Nombre) = LOWER(:padre)', { padre: padreLimpio })
        .andWhere('c.Tipo = :tipo', { tipo: tipoNormalizado })
        .andWhere("(c.Padre = '' OR c.Padre IS NULL)")
        .getOne();

      if (!padreExiste) {
        throw new BadRequestException(
          'La categoría padre no existe. Créela primero.',
        );
      }
    }

    const qb = this.repo
      .createQueryBuilder('c')
      .where('LOWER(c.Nombre) = LOWER(:nombre)', { nombre: limpio })
      .andWhere('c.Tipo = :tipo', { tipo: tipoNormalizado });

    if (padreLimpio) {
      qb.andWhere('LOWER(c.Padre) = LOWER(:padre)', { padre: padreLimpio });
    } else {
      qb.andWhere("(c.Padre = '' OR c.Padre IS NULL)");
    }

    const existente = await qb.getOne();
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

  /** Renombra (propagando el nombre a productos, fotos, documentos y subcategorías) y/o cambia el ícono. */
  async actualizar(
    id: string,
    cambios: { nombre?: string; icono?: string },
  ): Promise<Categoria> {
    const item = await this.repo.findOne({ where: { Id: id } });
    if (!item) throw new NotFoundException('La categoría no existe.');

    if (cambios.icono != null) {
      const icono = String(cambios.icono).trim().toLowerCase();
      if (!ICONO_VALIDO.test(icono)) {
        throw new BadRequestException('Ícono no válido.');
      }
      item.Icono = icono;
    }

    const viejo = item.Nombre;
    const nuevo =
      cambios.nombre != null ? this.normalizarNombre(cambios.nombre) : viejo;
    if (!nuevo) throw new BadRequestException('Ingrese el nombre de la categoría.');
    if (nuevo.length > 80) {
      throw new BadRequestException('El nombre admite hasta 80 caracteres.');
    }

    const padre = item.Padre || '';
    if (nuevo.toLowerCase() !== viejo.toLowerCase()) {
      const qb = this.repo
        .createQueryBuilder('c')
        .where('LOWER(c.Nombre) = LOWER(:nombre)', { nombre: nuevo })
        .andWhere('c.Tipo = :tipo', { tipo: item.Tipo })
        .andWhere('c.Id <> :id', { id });
      if (padre) {
        qb.andWhere('LOWER(c.Padre) = LOWER(:padre)', { padre });
      } else {
        qb.andWhere("(c.Padre = '' OR c.Padre IS NULL)");
      }
      if (await qb.getCount()) {
        throw new ConflictException('Ya existe una categoría con ese nombre.');
      }
    }

    if (nuevo === viejo) return this.repo.save(item);

    return this.repo.manager.transaction(async (em) => {
      item.Nombre = nuevo;
      const guardada = await em.save(item);
      const tablaPorTipo: Record<string, string> = {
        [TIPO_CATEGORIA_PRODUCTO]: 'productos',
        [TIPO_CATEGORIA_DOCUMENTO]: 'documentos',
        [TIPO_CATEGORIA_GALERIA]: 'galeria_institucional',
      };
      const tabla = tablaPorTipo[item.Tipo];

      if (padre) {
        if (item.Tipo !== TIPO_CATEGORIA_GALERIA) {
          await em.query(
            `UPDATE ${tabla} SET "Subcategoria" = $1
             WHERE LOWER("Categoria") = LOWER($2) AND LOWER("Subcategoria") = LOWER($3)`,
            [nuevo, padre, viejo],
          );
        }
      } else {
        await em.query(
          `UPDATE categorias SET "Padre" = $1 WHERE "Tipo" = $2 AND LOWER("Padre") = LOWER($3)`,
          [nuevo, item.Tipo, viejo],
        );
        await em.query(
          `UPDATE ${tabla} SET "Categoria" = $1 WHERE LOWER("Categoria") = LOWER($2)`,
          [nuevo, viejo],
        );
      }
      return guardada;
    });
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
      if (item.Tipo === TIPO_CATEGORIA_GALERIA) {
        throw new ConflictException(
          'No se puede borrar: hay fotos de la galería con esta categoría.',
        );
      }
      if (item.Tipo === TIPO_CATEGORIA_DOCUMENTO) {
        throw new ConflictException(
          padre
            ? 'No se puede borrar: hay documentos con esta subcategoría.'
            : 'No se puede borrar: hay documentos con esta categoría.',
        );
      }
      throw new ConflictException(
        padre
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

    if (tipo === TIPO_CATEGORIA_DOCUMENTO) {
      if (padre) {
        return this.documentosRepo
          .createQueryBuilder('doc')
          .where('LOWER(doc.Categoria) = LOWER(:padre)', { padre })
          .andWhere('LOWER(doc.Subcategoria) = LOWER(:nombre)', { nombre })
          .getCount();
      }
      return this.documentosRepo
        .createQueryBuilder('doc')
        .where('LOWER(doc.Categoria) = LOWER(:nombre)', { nombre })
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
