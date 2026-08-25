import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';

export const CANONICAL_LOCATIONS = [
  { code: 'BODEGA_CENTRAL', name: 'Bodega Central' },
  { code: 'POS_FUNA_UNA', name: 'FUNA-UNA' },
  { code: 'POS_EDITORIAL', name: 'Editorial' },
  { code: 'POS_STAND_FERIAS', name: 'Stand Ferias' },
] as const;

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
  ) {}

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

  private validarCodigoUbicacion(locationCode: unknown): LocationCode {
    if (
      typeof locationCode !== 'string' ||
      !CANONICAL_LOCATIONS.some(({ code }) => code === locationCode)
    ) {
      throw new BadRequestException('El código de ubicación no es válido.');
    }

    return locationCode as LocationCode;
  }
}
