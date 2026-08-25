import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';

export const CANONICAL_LOCATIONS = [
  { code: 'BODEGA_CENTRAL', name: 'Bodega Central' },
  { code: 'POS_FUNA_UNA', name: 'FUNA-UNA' },
  { code: 'POS_EDITORIAL', name: 'Editorial' },
  { code: 'POS_STAND_FERIAS', name: 'Stand Ferias' },
] as const;

export const BODEGA_CENTRAL = 'BODEGA_CENTRAL';

type LocationCode = (typeof CANONICAL_LOCATIONS)[number]['code'];

export type InventoryLocationResponse = {
  code: string;
  name: string;
};

export type InventoryLocationStockResponse = {
  productId: string;
  locationCode: LocationCode;
  stock: number;
  provisioned: boolean;
};

@Injectable()
export class InventarioService {
  constructor(
    @InjectRepository(InventarioUbicacion)
    private readonly locationsRepository: Repository<InventarioUbicacion>,
    @InjectRepository(InventarioStockUbicacion)
    private readonly stockRepository: Repository<InventarioStockUbicacion>,
    @InjectRepository(Producto)
    private readonly productsRepository: Repository<Producto>,
    private readonly dataSource: DataSource,
  ) {}

  async actualizarStockCentral(
    productId: string,
    stock: unknown,
  ): Promise<{
    productId: string;
    locationCode: typeof BODEGA_CENTRAL;
    stock: number;
  } | null> {
    const validatedStock = this.validarStockCentral(stock);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const centralLocation = await queryRunner.manager.findOne(
        InventarioUbicacion,
        { where: { Codigo: BODEGA_CENTRAL } },
      );
      if (!centralLocation) {
        throw new NotFoundException(
          'La ubicación de inventario no está inicializada.',
        );
      }

      const product = await queryRunner.manager.findOne(Producto, {
        where: { Id: productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        await queryRunner.rollbackTransaction();
        return null;
      }

      const balance = await queryRunner.manager.findOne(
        InventarioStockUbicacion,
        {
          where: {
            ProductoId: productId,
            UbicacionId: centralLocation.Id,
          },
          lock: { mode: 'pessimistic_write' },
        },
      );
      if (!balance) {
        throw new NotFoundException(
          'El balance de Bodega Central no está inicializado.',
        );
      }

      balance.Stock = validatedStock;
      product.Stock = validatedStock;
      if (validatedStock === 0) product.EsDestacado = false;

      await queryRunner.manager.save(balance);
      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();

      return {
        productId: product.Id,
        locationCode: BODEGA_CENTRAL,
        stock: validatedStock,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async obtenerUbicaciones(): Promise<InventoryLocationResponse[]> {
    const locations = await this.locationsRepository.find({
      order: { Id: 'ASC' },
    });
    const byCode = new Map(
      locations.map((location) => [location.Codigo, location]),
    );

    return CANONICAL_LOCATIONS.flatMap(({ code, name }) => {
      const location = byCode.get(code);
      return location
        ? [{ code: location.Codigo, name: location.Nombre || name }]
        : [];
    });
  }

  async obtenerStockProducto(
    productId: string,
    locationCode: unknown,
  ): Promise<InventoryLocationStockResponse | null> {
    const canonicalCode = this.validarCodigoUbicacion(locationCode);
    const product = await this.productsRepository.findOne({
      where: { Id: productId },
    });
    if (!product) return null;

    const location = await this.locationsRepository.findOne({
      where: { Codigo: canonicalCode },
    });
    if (!location) {
      throw new NotFoundException(
        'La ubicación de inventario no está inicializada.',
      );
    }

    const balance = await this.stockRepository.findOne({
      where: {
        ProductoId: productId,
        UbicacionId: location.Id,
      },
    });

    return {
      productId,
      locationCode: canonicalCode,
      stock: balance?.Stock ?? 0,
      provisioned: Boolean(balance),
    };
  }

  async obtenerStockPorUbicacion(
    locationCode: unknown,
  ): Promise<InventoryLocationStockResponse[]> {
    const canonicalCode = this.validarCodigoUbicacion(locationCode);
    const location = await this.locationsRepository.findOne({
      where: { Codigo: canonicalCode },
    });
    if (!location) {
      throw new NotFoundException(
        'La ubicación de inventario no está inicializada.',
      );
    }

    const products = await this.productsRepository.find({
      order: { Id: 'ASC' },
    });
    if (products.length === 0) return [];

    const balances = await this.stockRepository.find({
      where: { UbicacionId: location.Id },
    });
    const balancesByProduct = new Map(
      balances
        .filter(
          (balance) => String(balance.UbicacionId) === String(location.Id),
        )
        .map((balance) => [String(balance.ProductoId), balance]),
    );

    return products.map((product) => {
      const balance = balancesByProduct.get(String(product.Id));
      return {
        productId: String(product.Id),
        locationCode: canonicalCode,
        stock: balance?.Stock ?? 0,
        provisioned: Boolean(balance),
      };
    });
  }

  private validarCodigoUbicacion(locationCode: unknown): LocationCode {
    if (
      typeof locationCode !== 'string' ||
      !CANONICAL_LOCATIONS.some(({ code }) => code === locationCode)
    ) {
      throw new BadRequestException('El código de ubicación no es válido.');
    }

    return locationCode as LocationCode;
  }

  private validarStockCentral(stock: unknown): number {
    if (
      typeof stock !== 'number' ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      stock > 2147483647
    ) {
      throw new BadRequestException(
        'La cantidad de stock central debe ser un entero entre 0 y 2147483647.',
      );
    }

    return stock;
  }
}
