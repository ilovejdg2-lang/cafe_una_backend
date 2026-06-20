import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Producto } from '../entities/producto.entity';

const IVA_RATE = 0.13;
const ESTADO_HABILITADO = 'Habilitado';
const ESTADO_DESHABILITADO = 'Deshabilitado';
const MAX_PRODUCTOS_DESTACADOS = 3;

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private readonly repo: Repository<Producto>,
    private readonly dataSource: DataSource,
  ) {}

  async obtenerTodos(): Promise<Producto[]> {
    return this.repo.find({ order: { Id: 'ASC' } });
  }

  async crear(request: {
    Nombre: string;
    Descripcion: string;
    Imagen: string;
    PrecioNormal: number;
    Stock: number;
    Estado?: string;
    Peso: string;
    EsDestacado: boolean;
  }): Promise<Producto> {
    this.validarDatosProducto(
      request.Nombre,
      request.Descripcion,
      request.PrecioNormal,
      request.Stock,
    );

    const estado = this.normalizarEstado(request.Estado);
    if (request.EsDestacado) {
      await this.validarLimiteDestacados(null);
      this.validarProductoDestacable(estado, request.Stock);
    }

    const producto = this.repo.create({
      Nombre: request.Nombre.trim(),
      Descripcion: request.Descripcion.trim(),
      Imagen: request.Imagen.trim(),
      PrecioNormal: request.PrecioNormal.toFixed(2),
      PrecioConIVA: this.calcularPrecioConIVA(request.PrecioNormal).toFixed(2),
      Stock: request.Stock,
      Estado: estado,
      Peso: request.Peso.trim(),
      EsDestacado: request.EsDestacado,
    });

    return this.repo.save(producto);
  }

  async actualizar(
    id: string,
    cambios: {
      Nombre?: string;
      Descripcion?: string;
      Imagen?: string;
      PrecioNormal?: number;
      PrecioConIVA?: number;
      Stock?: number;
      Estado?: string;
      Peso?: string;
      EsDestacado?: boolean;
    },
  ): Promise<Producto | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    if (cambios.Nombre?.trim()) actual.Nombre = cambios.Nombre.trim();
    if (cambios.Descripcion?.trim()) actual.Descripcion = cambios.Descripcion.trim();
    if (cambios.Imagen != null) actual.Imagen = cambios.Imagen.trim();

    if (cambios.PrecioNormal != null) {
      if (cambios.PrecioNormal < 0) {
        throw new Error('El precio normal no puede ser negativo.');
      }
      actual.PrecioNormal = cambios.PrecioNormal.toFixed(2);
      actual.PrecioConIVA = this.calcularPrecioConIVA(cambios.PrecioNormal).toFixed(
        2,
      );
    } else if (cambios.PrecioConIVA != null) {
      actual.PrecioConIVA = cambios.PrecioConIVA.toFixed(2);
    }

    if (cambios.Stock != null) {
      if (cambios.Stock < 0) throw new Error('El stock no puede ser negativo.');
      if (cambios.Stock <= 0 && actual.EsDestacado) {
        throw new Error(
          'Quita el producto de destacados antes de dejar el stock en cero.',
        );
      }
      actual.Stock = cambios.Stock;
      if (actual.Stock <= 0) actual.EsDestacado = false;
    }

    if (cambios.Peso != null) actual.Peso = cambios.Peso.trim();

    if (cambios.Estado?.trim()) {
      const nuevoEstado = this.normalizarEstado(cambios.Estado);
      if (nuevoEstado === ESTADO_DESHABILITADO && actual.EsDestacado) {
        throw new Error(
          'Quita el producto de destacados antes de deshabilitarlo.',
        );
      }
      actual.Estado = nuevoEstado;
    }

    if (cambios.EsDestacado != null) {
      if (cambios.EsDestacado && !actual.EsDestacado) {
        await this.validarLimiteDestacados(actual.Id);
        this.validarProductoDestacable(actual.Estado, actual.Stock);
      }
      actual.EsDestacado = cambios.EsDestacado;
    }

    return this.repo.save(actual);
  }

  async eliminar(id: string): Promise<boolean> {
    const producto = await this.repo.findOne({ where: { Id: id } });
    if (!producto) return false;
    await this.repo.remove(producto);
    return true;
  }

  async ajustarStock(
    items: { Id: number | string; Units: number }[],
  ): Promise<Producto[]> {
    const solicitudes = (items ?? []).filter(
      (item) => Number(item.Id) > 0 && item.Units > 0,
    );
    if (solicitudes.length === 0) return [];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const actualizados: Producto[] = [];

      for (const solicitud of solicitudes) {
        const id = String(solicitud.Id);
        const producto = await queryRunner.manager.findOne(Producto, {
          where: { Id: id },
        });
        if (!producto) {
          throw new Error(`No se encontró el producto con id ${solicitud.Id}.`);
        }
        if (producto.Estado === ESTADO_DESHABILITADO) {
          throw new Error(`El producto ${producto.Nombre} está deshabilitado.`);
        }
        if (producto.Stock < solicitud.Units) {
          throw new Error(`No hay stock suficiente para ${producto.Nombre}.`);
        }
        producto.Stock -= solicitud.Units;
        if (producto.Stock <= 0) producto.EsDestacado = false;
        actualizados.push(await queryRunner.manager.save(producto));
      }

      await queryRunner.commitTransaction();
      return actualizados;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private calcularPrecioConIVA(precioNormal: number): number {
    return Math.round(precioNormal * (1 + IVA_RATE));
  }

  private async validarLimiteDestacados(excluirId: string | null): Promise<void> {
    const qb = this.repo.createQueryBuilder('p').where('p.EsDestacado = true');
    if (excluirId) qb.andWhere('p.Id != :id', { id: excluirId });
    const count = await qb.getCount();
    if (count >= MAX_PRODUCTOS_DESTACADOS) {
      throw new Error(
        `Solo se pueden destacar hasta ${MAX_PRODUCTOS_DESTACADOS} productos en el inicio.`,
      );
    }
  }

  private validarProductoDestacable(estado: string, stock: number): void {
    if (estado === ESTADO_DESHABILITADO) {
      throw new Error('No se puede destacar un producto deshabilitado.');
    }
    if (stock <= 0) {
      throw new Error('No se puede destacar un producto sin stock.');
    }
  }

  private normalizarEstado(estado?: string): string {
    return estado?.trim().toLowerCase() === ESTADO_DESHABILITADO.toLowerCase()
      ? ESTADO_DESHABILITADO
      : ESTADO_HABILITADO;
  }

  private validarDatosProducto(
    nombre: string,
    descripcion: string,
    precioNormal: number,
    stock: number,
  ): void {
    if (!nombre?.trim()) {
      throw new Error('El nombre del producto es obligatorio.');
    }
    if (!descripcion?.trim()) {
      throw new Error('La descripción del producto es obligatoria.');
    }
    if (precioNormal < 0) {
      throw new Error('El precio normal no puede ser negativo.');
    }
    if (stock < 0) throw new Error('El stock no puede ser negativo.');
  }
}
