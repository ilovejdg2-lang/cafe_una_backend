import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CarritoItem } from '../entities/carrito-item.entity';
import { Producto } from '../entities/producto.entity';

const MAX_ITEMS_CARRITO = 100;
const MAX_CANTIDAD_ITEM = 999;

export type CarritoItemResponse = {
  productoId: string;
  cantidad: number;
};

@Injectable()
export class CarritoService {
  constructor(
    @InjectRepository(CarritoItem)
    private readonly carritoRepo: Repository<CarritoItem>,
    private readonly dataSource: DataSource,
  ) {}

  async listar(usuarioId: number): Promise<CarritoItemResponse[]> {
    const items = await this.carritoRepo.find({
      where: { UsuarioId: usuarioId },
      order: { ActualizadoEn: 'ASC' },
    });
    return items.map((item) => ({
      productoId: String(item.ProductoId),
      cantidad: Number(item.Cantidad),
    }));
  }

  async reemplazar(
    usuarioId: number,
    body: unknown,
  ): Promise<CarritoItemResponse[]> {
    const items = this.normalizarItems(body);

    await this.dataSource.transaction(async (manager) => {
      const existentes = items.length
        ? await manager.getRepository(Producto).find({
            select: { Id: true },
            where: { Id: In(items.map((item) => item.productoId)) },
          })
        : [];
      const idsValidos = new Set(existentes.map((p) => String(p.Id)));

      await manager.delete(CarritoItem, { UsuarioId: usuarioId });

      const filas = items
        .filter((item) => idsValidos.has(item.productoId))
        .map((item) =>
          manager.create(CarritoItem, {
            UsuarioId: usuarioId,
            ProductoId: item.productoId,
            Cantidad: item.cantidad,
          }),
        );
      if (filas.length) await manager.save(CarritoItem, filas);
    });

    return this.listar(usuarioId);
  }

  private normalizarItems(body: unknown): CarritoItemResponse[] {
    const fuente = body as Record<string, unknown> | null;
    const lista = Array.isArray(body)
      ? body
      : (fuente?.items ?? fuente?.Items);
    if (!Array.isArray(lista)) {
      throw new BadRequestException('El carrito no tiene un formato válido.');
    }
    if (lista.length > MAX_ITEMS_CARRITO) {
      throw new BadRequestException(
        `El carrito admite como máximo ${MAX_ITEMS_CARRITO} productos.`,
      );
    }

    const porProducto = new Map<string, number>();
    for (const raw of lista) {
      const item = (raw ?? {}) as Record<string, unknown>;
      const productoId = String(item.productoId ?? item.ProductoId ?? '').trim();
      const cantidad = Number(item.cantidad ?? item.Cantidad);
      if (!/^\d{1,18}$/.test(productoId)) {
        throw new BadRequestException('Hay un producto no válido en el carrito.');
      }
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        throw new BadRequestException('Hay una cantidad no válida en el carrito.');
      }
      const acumulado = (porProducto.get(productoId) ?? 0) + cantidad;
      porProducto.set(productoId, Math.min(acumulado, MAX_CANTIDAD_ITEM));
    }

    return [...porProducto].map(([productoId, cantidad]) => ({
      productoId,
      cantidad,
    }));
  }
}
