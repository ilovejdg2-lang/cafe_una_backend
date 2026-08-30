import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import {
  CategoriasService,
  TIPO_CATEGORIA_PRODUCTO,
} from './categorias.service';
import { InventarioService, BODEGA_CENTRAL } from './inventario.service';
import { StockAlertaService } from './stock-alerta.service';

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
    private readonly categoriasService: CategoriasService,
    private readonly inventarioService: InventarioService,
    private readonly stockAlertaService: StockAlertaService,
  ) {}

  async obtenerTodos(): Promise<Producto[]> {
    return this.repo.find({ order: { Id: 'ASC' } });
  }

  async obtenerTodosConStockTotal(): Promise<
    Array<Producto & { stockTotal: number; stock_total: number }>
  > {
    const productos = await this.obtenerTodos();
    const totales = await this.inventarioService.obtenerTotalesStockPorProducto();
    return productos.map((producto) => {
      const stockTotal =
        totales.get(String(producto.Id)) ?? (Number(producto.Stock) || 0);
      return Object.assign(producto, {
        stockTotal,
        stock_total: stockTotal,
      });
    });
  }

  async obtenerPorId(id: string): Promise<Producto | null> {
    if (!id?.trim()) return null;
    return this.repo.findOne({ where: { Id: id } });
  }

  async crear(request: {
    Nombre: string;
    Descripcion: string;
    NombreEn?: string;
    DescripcionEn?: string;
    Imagen: string;
    PrecioNormal: number;
    Stock: number;
    Estado?: string;
    Peso: string;
    Categoria?: string;
    Subcategoria?: string;
    EsDestacado: boolean;
    StockMinimo?: number;
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

    const categoria = await this.resolverCategoria(request.Categoria);
    const subcategoria = await this.resolverSubcategoria(
      categoria,
      request.Subcategoria,
    );
    const stockMinimo = this.normalizarStockMinimo(request.StockMinimo);
    const producto = this.repo.create({
      Nombre: request.Nombre.trim(),
      Descripcion: request.Descripcion.trim(),
      NombreEn: (request.NombreEn ?? '').trim(),
      DescripcionEn: (request.DescripcionEn ?? '').trim(),
      Imagen: request.Imagen.trim(),
      PrecioNormal: request.PrecioNormal.toFixed(2),
      PrecioConIVA: this.calcularPrecioConIVA(request.PrecioNormal).toFixed(2),
      Stock: request.Stock,
      Estado: estado,
      Peso: request.Peso.trim(),
      Categoria: categoria,
      Subcategoria: subcategoria,
      EsDestacado: request.EsDestacado,
      StockMinimo: stockMinimo,
      AlertaStock: request.Stock <= stockMinimo,
      Disponible: request.Stock > 0,
    });

    const guardado = await this.repo.save(producto);
    await this.stockAlertaService.verificarTrasMovimiento(String(guardado.Id));
    return (await this.obtenerPorId(String(guardado.Id))) ?? guardado;
  }

  async actualizar(
    id: string,
    cambios: {
      Nombre?: string;
      Descripcion?: string;
      NombreEn?: string;
      DescripcionEn?: string;
      Imagen?: string;
      PrecioNormal?: number;
      PrecioConIVA?: number;
      Stock?: number;
      Estado?: string;
      Peso?: string;
      Categoria?: string;
      Subcategoria?: string;
      EsDestacado?: boolean;
      StockMinimo?: number;
    },
  ): Promise<Producto | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    if (cambios.Nombre?.trim()) actual.Nombre = cambios.Nombre.trim();
    if (cambios.Descripcion?.trim())
      actual.Descripcion = cambios.Descripcion.trim();
    if (cambios.NombreEn != null) actual.NombreEn = cambios.NombreEn.trim();
    if (cambios.DescripcionEn != null) {
      actual.DescripcionEn = cambios.DescripcionEn.trim();
    }
    if (cambios.Imagen != null) actual.Imagen = cambios.Imagen.trim();

    if (cambios.PrecioNormal != null) {
      if (cambios.PrecioNormal < 0) {
        throw new Error('El precio normal no puede ser negativo.');
      }
      actual.PrecioNormal = cambios.PrecioNormal.toFixed(2);
      actual.PrecioConIVA = this.calcularPrecioConIVA(
        cambios.PrecioNormal,
      ).toFixed(2);
    } else if (cambios.PrecioConIVA != null) {
      actual.PrecioConIVA = cambios.PrecioConIVA.toFixed(2);
    }

    let stockCambio = false;
    if (cambios.Stock != null) {
      // Stock solo vía ledger de Bodega Central (evita desfase con ubicaciones).
      await this.inventarioService.actualizarStockCentral(id, cambios.Stock);
      stockCambio = true;
      const refrescado = await this.repo.findOne({ where: { Id: id } });
      if (refrescado) {
        actual.Stock = refrescado.Stock;
        actual.EsDestacado = refrescado.EsDestacado;
      }
    }

    if (cambios.StockMinimo != null) {
      actual.StockMinimo = this.normalizarStockMinimo(cambios.StockMinimo);
      stockCambio = true;
    }

    if (cambios.Peso != null) actual.Peso = cambios.Peso.trim();
    if (cambios.Categoria != null) {
      actual.Categoria = await this.resolverCategoria(cambios.Categoria);
      if (cambios.Subcategoria == null) {
        actual.Subcategoria = '';
      }
    }
    if (cambios.Subcategoria != null) {
      actual.Subcategoria = await this.resolverSubcategoria(
        actual.Categoria,
        cambios.Subcategoria,
      );
    }

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

    await this.repo.save(actual);
    if (stockCambio) {
      await this.stockAlertaService.verificarTrasMovimiento(String(actual.Id));
    }
    return this.obtenerPorId(String(actual.Id));
  }

  async actualizarStockCentral(
    id: string,
    stock: unknown,
  ): Promise<{
    productId: string;
    locationCode: string;
    stock: number;
  } | null> {
    return this.inventarioService.actualizarStockCentral(id, stock);
  }

  async eliminar(id: string): Promise<boolean> {
    const producto = await this.repo.findOne({ where: { Id: id } });
    if (!producto) return false;
    producto.Estado = ESTADO_DESHABILITADO;
    producto.EsDestacado = false;
    await this.repo.save(producto);
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
          lock: { mode: 'pessimistic_write' },
        });
        if (!producto) {
          throw new Error(`No se encontró el producto con id ${solicitud.Id}.`);
        }
        if (producto.Estado === ESTADO_DESHABILITADO) {
          throw new Error(`El producto ${producto.Nombre} está deshabilitado.`);
        }

        const central = await queryRunner.manager.findOne(InventarioUbicacion, {
          where: { Codigo: BODEGA_CENTRAL },
        });
        if (!central) {
          throw new Error('La Bodega Central no está inicializada.');
        }

        let balance = await queryRunner.manager.findOne(
          InventarioStockUbicacion,
          {
            where: {
              ProductoId: id,
              UbicacionId: central.Id,
            },
            lock: { mode: 'pessimistic_write' },
          },
        );
        const disponible = Number(balance?.Stock ?? producto.Stock) || 0;
        if (disponible < solicitud.Units) {
          throw new Error(`No hay stock suficiente para ${producto.Nombre}.`);
        }
        if (!balance) {
          balance = queryRunner.manager.create(InventarioStockUbicacion, {
            ProductoId: id,
            UbicacionId: central.Id,
            Stock: disponible,
          });
        }
        balance.Stock = disponible - solicitud.Units;
        producto.Stock = balance.Stock;
        if (producto.Stock <= 0) producto.EsDestacado = false;
        await queryRunner.manager.save(balance);
        actualizados.push(await queryRunner.manager.save(producto));
      }

      await queryRunner.commitTransaction();
      for (const producto of actualizados) {
        await this.stockAlertaService.verificarTrasMovimiento(String(producto.Id));
      }
      return actualizados;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  listarAlertasStock() {
    return this.stockAlertaService.listarAlertas();
  }

  private normalizarStockMinimo(valor: unknown): number {
    if (valor === undefined || valor === null || valor === '') return 0;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Error('El stock mínimo debe ser un entero mayor o igual a 0.');
    }
    return n;
  }

  private calcularPrecioConIVA(precioNormal: number): number {
    return Math.round(precioNormal * (1 + IVA_RATE));
  }

  private async validarLimiteDestacados(
    excluirId: string | null,
  ): Promise<void> {
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

  private async resolverCategoria(categoria?: string): Promise<string> {
    const limpio = String(categoria || '').trim();
    if (!limpio) return '';
    return this.categoriasService.asegurar(limpio, TIPO_CATEGORIA_PRODUCTO);
  }

  private async resolverSubcategoria(
    categoria: string,
    subcategoria?: string,
  ): Promise<string> {
    const limpio = String(subcategoria || '').trim();
    if (!limpio) return '';
    if (!categoria) {
      throw new Error(
        'Seleccione una categoría antes de asignar una subcategoría.',
      );
    }
    return this.categoriasService.asegurar(
      limpio,
      TIPO_CATEGORIA_PRODUCTO,
      categoria,
    );
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
