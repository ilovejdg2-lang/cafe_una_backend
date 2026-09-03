import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { getAuditoriaUserId } from '../common/auditoria-context';
import { Auditoria } from '../entities/auditoria.entity';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Transferencia } from '../entities/transferencia.entity';
import { Usuario } from '../entities/usuario.entity';
import { StockAlertaService } from './stock-alerta.service';

export const CANONICAL_LOCATIONS = [
  { code: 'BODEGA_CENTRAL', name: 'Bodega Central' },
  { code: 'POS_FUNA_UNA', name: 'FUNA-UNA' },
  { code: 'POS_EDITORIAL', name: 'Editorial' },
  { code: 'POS_STAND_FERIAS', name: 'Stand Ferias' },
] as const;

export const BODEGA_CENTRAL = 'BODEGA_CENTRAL';

const LOCATION_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,48}$/;

export type InventoryLocationResponse = {
  code: string;
  name: string;
  activo: boolean;
};

export type InventoryLocationStockResponse = {
  productId: string;
  locationCode: string;
  stock: number;
  provisioned: boolean;
};

export type InventoryStockAdjustmentResponse = {
  productId: string;
  locationCode: string;
  previousStock: number;
  stock: number;
  reason: string;
};

export type RespuestaTransferencia = {
  id: string;
  productoId: string;
  cantidad: number;
  notas: string;
  fecha: string;
  origen: { codigo: string; nombre: string; stock: number };
  destino: { codigo: string; nombre: string; stock: number };
  responsableId: number | null;
};

export type HistorialTransferenciaItem = {
  id: string;
  fecha: string;
  productoId: string;
  productoNombre: string;
  cantidad: number;
  destinoCodigo: string;
  destinoNombre: string;
  responsableId: number | null;
  responsableNombre?: string | null;
  notas: string;
};

export type HistorialTransferenciasResponse = {
  items: HistorialTransferenciaItem[];
  total: number;
  page: number;
  pageSize: number;
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
    @InjectRepository(Transferencia)
    private readonly transferenciasRepository: Repository<Transferencia>,
    private readonly dataSource: DataSource,
    private readonly stockAlertaService: StockAlertaService,
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

      await this.stockAlertaService.verificarTrasMovimiento(String(product.Id));

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

  async ajustarStockUbicacion(
    locationCode: unknown,
    productId: unknown,
    stock: unknown,
    reason: unknown,
  ): Promise<InventoryStockAdjustmentResponse | null> {
    const code = this.normalizarCodigoEntrada(locationCode);
    if (code === BODEGA_CENTRAL) {
      throw new BadRequestException(
        'La ruta de ajustes solo admite puntos de venta.',
      );
    }

    const validatedProductId = this.validarProductId(productId);
    const validatedStock = this.validarStock(stock);
    const validatedReason = this.validarReason(reason);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const location = await queryRunner.manager.findOne(InventarioUbicacion, {
        where: { Codigo: code },
      });
      if (!location) {
        throw new NotFoundException(
          'La ubicación de inventario no está inicializada.',
        );
      }
      if (location.Activo === false) {
        throw new BadRequestException(
          'No se puede ajustar stock en un punto de venta inactivo.',
        );
      }

      const product = await queryRunner.manager.findOne(Producto, {
        where: { Id: validatedProductId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        await queryRunner.rollbackTransaction();
        return null;
      }

      let balance = await queryRunner.manager.findOne(
        InventarioStockUbicacion,
        {
          where: {
            ProductoId: validatedProductId,
            UbicacionId: location.Id,
          },
          lock: { mode: 'pessimistic_write' },
        },
      );

      const previousStock = balance?.Stock ?? 0;
      if (!balance) {
        balance = queryRunner.manager.create(InventarioStockUbicacion, {
          ProductoId: validatedProductId,
          UbicacionId: location.Id,
          Stock: validatedStock,
        });
      } else {
        balance.Stock = validatedStock;
      }

      if (previousStock !== validatedStock) {
        await queryRunner.manager.save(balance);
        await queryRunner.manager.insert(Auditoria, {
          Accion: 'AJUSTE_STOCK',
          Tabla: 'inventario_stock_ubicaciones',
          IdRegistro: balance.Id,
          Detalle: `Producto ${validatedProductId}; ubicación ${code}; anterior ${previousStock}; nuevo ${validatedStock}; motivo: ${validatedReason}`,
          DatosAnteriores: { Stock: previousStock },
          DatosNuevos: { Stock: validatedStock, Motivo: validatedReason },
          Fecha: new Date(),
          IdUsuario: getAuditoriaUserId(),
        });
      } else if (!balance.Id) {
        await queryRunner.manager.save(balance);
      }
      await queryRunner.commitTransaction();

      await this.stockAlertaService.verificarTrasMovimiento(validatedProductId);

      return {
        productId: validatedProductId,
        locationCode: code,
        previousStock,
        stock: validatedStock,
        reason: validatedReason,
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

  async transferir(
    body: Record<string, unknown>,
    responsableId: number | null,
  ): Promise<RespuestaTransferencia> {
    const productoId = this.validarProductId(
      this.normalizarIdentidadProducto(
        this.tomarCampo(body, 'productoId', 'ProductoId'),
      ),
    );
    const cantidad = this.validarCantidadTransferencia(
      this.tomarCampo(body, 'cantidad', 'Cantidad'),
    );
    const notas = this.validarNotasTransferencia(
      this.tomarCampo(body, 'notas', 'Notas'),
    );
    const destinoRef = this.tomarCampo(
      body,
      'ubicacionDestinoId',
      'UbicacionDestinoId',
      'ubicacionDestino',
      'UbicacionDestino',
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const origen = await queryRunner.manager.findOne(InventarioUbicacion, {
        where: { Codigo: BODEGA_CENTRAL },
      });
      if (!origen) {
        throw new NotFoundException(
          'La ubicación de inventario no está inicializada.',
        );
      }

      const destino = await this.resolverUbicacionDestino(
        queryRunner.manager,
        destinoRef,
      );
      if (destino.Codigo === BODEGA_CENTRAL) {
        throw new BadRequestException(
          'El destino debe ser un punto de venta, no Bodega Central.',
        );
      }
      if (destino.Activo === false) {
        throw new BadRequestException(
          'No se puede transferir a un punto de venta inactivo.',
        );
      }

      const producto = await queryRunner.manager.findOne(Producto, {
        where: { Id: productoId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!producto) {
        throw new NotFoundException('No se encontró el producto.');
      }

      const saldoOrigen = await queryRunner.manager.findOne(
        InventarioStockUbicacion,
        {
          where: { ProductoId: productoId, UbicacionId: origen.Id },
          lock: { mode: 'pessimistic_write' },
        },
      );
      const disponible = Number(saldoOrigen?.Stock) || 0;
      if (!saldoOrigen || disponible < cantidad) {
        throw new BadRequestException(
          `No hay stock suficiente en Bodega Central. Disponible: ${disponible}.`,
        );
      }

      let saldoDestino = await queryRunner.manager.findOne(
        InventarioStockUbicacion,
        {
          where: { ProductoId: productoId, UbicacionId: destino.Id },
          lock: { mode: 'pessimistic_write' },
        },
      );
      if (!saldoDestino) {
        saldoDestino = queryRunner.manager.create(InventarioStockUbicacion, {
          ProductoId: productoId,
          UbicacionId: destino.Id,
          Stock: 0,
        });
      }

      saldoOrigen.Stock = disponible - cantidad;
      saldoDestino.Stock = (Number(saldoDestino.Stock) || 0) + cantidad;
      producto.Stock = saldoOrigen.Stock;
      if (producto.Stock <= 0) producto.EsDestacado = false;

      await queryRunner.manager.save(saldoOrigen);
      await queryRunner.manager.save(saldoDestino);
      await queryRunner.manager.save(producto);

      const transferencia = queryRunner.manager.create(Transferencia, {
        ProductoId: productoId,
        UbicacionOrigenId: origen.Id,
        UbicacionDestinoId: destino.Id,
        Cantidad: cantidad,
        ResponsableId: responsableId,
        Notas: notas,
        Fecha: new Date(),
      });
      const guardada = await queryRunner.manager.save(transferencia);

      await queryRunner.commitTransaction();
      await this.stockAlertaService.verificarTrasMovimiento(productoId);

      return {
        id: String(guardada.Id),
        productoId,
        cantidad,
        notas,
        fecha:
          guardada.Fecha instanceof Date
            ? guardada.Fecha.toISOString()
            : String(guardada.Fecha),
        origen: {
          codigo: origen.Codigo,
          nombre: origen.Nombre,
          stock: saldoOrigen.Stock,
        },
        destino: {
          codigo: destino.Codigo,
          nombre: destino.Nombre,
          stock: saldoDestino.Stock,
        },
        responsableId,
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

  async listarHistorialTransferencias(filtros: {
    fechaDesde?: string;
    fechaHasta?: string;
    ubicacionDestino?: string;
    ubicacionDestinoId?: string;
    codigo?: string;
    page?: string;
    pageSize?: string;
  }): Promise<HistorialTransferenciasResponse> {
    const page = this.parsearEnteroPositivo(filtros.page, 1, 'página');
    const pageSizeRaw = this.parsearEnteroPositivo(
      filtros.pageSize,
      20,
      'tamaño de página',
    );
    const pageSize = Math.min(pageSizeRaw, 20);

    const qb = this.transferenciasRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.Producto', 'producto')
      .leftJoinAndSelect('t.Destino', 'destino')
      .leftJoinAndSelect('t.Responsable', 'responsable')
      .orderBy('t.Fecha', 'DESC');

    const fechaDesde = (filtros.fechaDesde ?? '').trim();
    if (fechaDesde) {
      const desde = this.parsearFechaIso(fechaDesde, 'fechaDesde');
      qb.andWhere('t.Fecha >= :fechaDesde', {
        fechaDesde: `${desde}T00:00:00.000Z`,
      });
    }

    const fechaHasta = (filtros.fechaHasta ?? '').trim();
    if (fechaHasta) {
      const hasta = this.parsearFechaIso(fechaHasta, 'fechaHasta');
      qb.andWhere('t.Fecha < :fechaHasta', {
        fechaHasta: this.siguienteDiaIso(hasta),
      });
    }

    const destinoIdRaw = (filtros.ubicacionDestinoId ?? '').trim();
    const destinoRef = (filtros.ubicacionDestino ?? '').trim();
    const codigoDestino = (filtros.codigo ?? '').trim();

    if (destinoIdRaw) {
      if (!/^\d+$/.test(destinoIdRaw)) {
        throw new BadRequestException(
          'El identificador de la ubicación destino no es válido.',
        );
      }
      qb.andWhere('t.UbicacionDestinoId = :destinoId', {
        destinoId: Number(destinoIdRaw),
      });
    } else if (destinoRef) {
      if (/^\d+$/.test(destinoRef)) {
        qb.andWhere('t.UbicacionDestinoId = :destinoId', {
          destinoId: Number(destinoRef),
        });
      } else {
        const code = this.normalizarCodigoEntrada(destinoRef);
        qb.andWhere('destino.Codigo = :destinoCodigo', {
          destinoCodigo: code,
        });
      }
    } else if (codigoDestino) {
      const code = this.normalizarCodigoEntrada(codigoDestino);
      qb.andWhere('destino.Codigo = :destinoCodigo', {
        destinoCodigo: code,
      });
    }

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: rows.map((row) => ({
        id: String(row.Id),
        fecha:
          row.Fecha instanceof Date
            ? row.Fecha.toISOString()
            : String(row.Fecha ?? ''),
        productoId: String(row.ProductoId),
        productoNombre: row.Producto?.Nombre ?? '',
        cantidad: Number(row.Cantidad) || 0,
        destinoCodigo: row.Destino?.Codigo ?? '',
        destinoNombre: row.Destino?.Nombre ?? '',
        responsableId: row.ResponsableId,
        responsableNombre: row.Responsable?.Nombre ?? null,
        notas: row.Notas ?? '',
      })),
      total,
      page,
      pageSize,
    };
  }

  async obtenerUbicaciones(): Promise<InventoryLocationResponse[]> {
    const ubicaciones = await this.locationsRepository.find({
      order: { Id: 'ASC' },
    });
    return ubicaciones.map((ubicacion) => this.mapearUbicacion(ubicacion));
  }

  async crearUbicacion(body: {
    codigo?: unknown;
    Codigo?: unknown;
    nombre?: unknown;
    Nombre?: unknown;
  }): Promise<InventoryLocationResponse> {
    const nombre = this.validarNombre(
      Object.prototype.hasOwnProperty.call(body ?? {}, 'nombre')
        ? body.nombre
        : body?.Nombre,
    );
    const codigoRaw = Object.prototype.hasOwnProperty.call(body ?? {}, 'codigo')
      ? body.codigo
      : body?.Codigo;
    const codigo =
      codigoRaw === undefined || codigoRaw === null || codigoRaw === ''
        ? await this.generarCodigoUnico(nombre)
        : this.validarCodigoNuevo(codigoRaw);

    if (codigo === BODEGA_CENTRAL) {
      throw new BadRequestException(
        'No se puede crear una ubicación con el código de Bodega Central.',
      );
    }

    const existente = await this.locationsRepository.findOne({
      where: { Codigo: codigo },
    });
    if (existente) {
      throw new BadRequestException(
        'Ya existe una ubicación con ese código.',
      );
    }

    const creada = await this.locationsRepository.save(
      this.locationsRepository.create({
        Codigo: codigo,
        Nombre: nombre,
        Activo: true,
      }),
    );

    await this.registrarAuditoriaUbicacion(
      'CREAR_UBICACION',
      creada.Id,
      `Creó punto de venta ${creada.Codigo} (${creada.Nombre})`,
    );

    return this.mapearUbicacion(creada);
  }

  async actualizarUbicacion(
    locationCode: unknown,
    body: {
      nombre?: unknown;
      Nombre?: unknown;
      activo?: unknown;
      Activo?: unknown;
    },
  ): Promise<InventoryLocationResponse> {
    const code = this.normalizarCodigoEntrada(locationCode);
    if (code === BODEGA_CENTRAL) {
      throw new BadRequestException(
        'Bodega Central no se puede editar ni inhabilitar.',
      );
    }

    const location = await this.locationsRepository.findOne({
      where: { Codigo: code },
    });
    if (!location) {
      throw new NotFoundException('La ubicación no existe.');
    }

    const hasNombre =
      Object.prototype.hasOwnProperty.call(body ?? {}, 'nombre') ||
      Object.prototype.hasOwnProperty.call(body ?? {}, 'Nombre');
    const hasActivo =
      Object.prototype.hasOwnProperty.call(body ?? {}, 'activo') ||
      Object.prototype.hasOwnProperty.call(body ?? {}, 'Activo');

    if (!hasNombre && !hasActivo) {
      throw new BadRequestException(
        'Debe indicar al menos nombre o activo para actualizar.',
      );
    }

    if (hasNombre) {
      location.Nombre = this.validarNombre(
        Object.prototype.hasOwnProperty.call(body, 'nombre')
          ? body.nombre
          : body.Nombre,
      );
    }
    if (hasActivo) {
      location.Activo = this.validarActivo(
        Object.prototype.hasOwnProperty.call(body, 'activo')
          ? body.activo
          : body.Activo,
      );
    }

    const guardada = await this.locationsRepository.save(location);
    await this.registrarAuditoriaUbicacion(
      'ACTUALIZAR_UBICACION',
      guardada.Id,
      `Actualizó punto de venta ${guardada.Codigo}; nombre ${guardada.Nombre}; activo ${guardada.Activo}`,
    );

    return this.mapearUbicacion(guardada);
  }

  async obtenerStockProducto(
    productId: string,
    locationCode: unknown,
  ): Promise<InventoryLocationStockResponse | null> {
    const code = await this.resolverCodigoExistente(locationCode);
    const product = await this.productsRepository.findOne({
      where: { Id: productId },
    });
    if (!product) return null;

    const location = await this.asegurarUbicacion(code);

    const balance = await this.stockRepository.findOne({
      where: {
        ProductoId: productId,
        UbicacionId: location.Id,
      },
    });

    return {
      productId,
      locationCode: code,
      stock: balance?.Stock ?? 0,
      provisioned: Boolean(balance),
    };
  }

  async obtenerStockDesglosadoProducto(productId: string): Promise<{
    productId: string;
    locations: Array<{ code: string; name: string; stock: number }>;
    total: number;
  } | null> {
    const product = await this.productsRepository.findOne({
      where: { Id: productId },
    });
    if (!product) return null;

    const locations = await this.locationsRepository.find({
      order: { Id: 'ASC' },
    });
    const byCode = new Map(
      locations.map((location) => [location.Codigo, location]),
    );
    for (const canonical of CANONICAL_LOCATIONS) {
      if (!byCode.has(canonical.code)) {
        const created = await this.asegurarUbicacion(canonical.code);
        byCode.set(created.Codigo, created);
      }
    }

    const ordered = CANONICAL_LOCATIONS.map(({ code }) => byCode.get(code)).filter(
      Boolean,
    ) as InventarioUbicacion[];
    for (const location of locations) {
      if (!CANONICAL_LOCATIONS.some((item) => item.code === location.Codigo)) {
        ordered.push(location);
      }
    }

    const balances = await this.stockRepository.find({
      where: { ProductoId: productId },
    });
    const stockByLocationId = new Map(
      balances.map((balance) => [Number(balance.UbicacionId), Number(balance.Stock) || 0]),
    );

    const locationRows = ordered.map((location) => ({
      code: location.Codigo,
      name: location.Nombre,
      stock: stockByLocationId.get(Number(location.Id)) ?? 0,
    }));

    return {
      productId: String(product.Id),
      locations: locationRows,
      total: locationRows.reduce((acc, row) => acc + row.stock, 0),
    };
  }

  async obtenerTotalesStockPorProducto(): Promise<Map<string, number>> {
    const rows: Array<{ productoId: string; total: string }> =
      await this.stockRepository
        .createQueryBuilder('stock')
        .select('stock.ProductoId', 'productoId')
        .addSelect('COALESCE(SUM(stock.Stock), 0)', 'total')
        .groupBy('stock.ProductoId')
        .getRawMany();

    return new Map(
      rows.map((row) => [String(row.productoId), Number(row.total) || 0]),
    );
  }

  async obtenerStockPorUbicacion(
    locationCode: unknown,
  ): Promise<InventoryLocationStockResponse[]> {
    const code = await this.resolverCodigoExistente(locationCode, {
      requerirActiva: true,
    });
    const location = await this.asegurarUbicacion(code);

    const products = await this.productsRepository.find({
      order: { Id: 'ASC' },
    });
    if (products.length === 0) return [];

    const balances = await this.stockRepository.find({
      where: { UbicacionId: location.Id },
    });
    const balancesByProduct = new Map(
      balances.map((balance) => [String(balance.ProductoId), balance]),
    );

    return products.map((product) => {
      const balance = balancesByProduct.get(String(product.Id));
      return {
        productId: String(product.Id),
        locationCode: code,
        stock: balance?.Stock ?? 0,
        provisioned: Boolean(balance),
      };
    });
  }

  private mapearUbicacion(
    location: InventarioUbicacion,
  ): InventoryLocationResponse {
    return {
      code: location.Codigo,
      name: location.Nombre,
      activo: location.Activo !== false,
    };
  }

  private async asegurarUbicacion(code: string) {
    const existente = await this.locationsRepository.findOne({
      where: { Codigo: code },
    });
    if (existente) return existente;

    const name =
      CANONICAL_LOCATIONS.find((item) => item.code === code)?.name ?? code;
    return this.locationsRepository.save(
      this.locationsRepository.create({
        Codigo: code,
        Nombre: name,
        Activo: true,
      }),
    );
  }

  private async resolverCodigoExistente(
    locationCode: unknown,
    options: { requerirActiva?: boolean } = {},
  ): Promise<string> {
    const code = this.normalizarCodigoEntrada(locationCode);
    const location = await this.locationsRepository.findOne({
      where: { Codigo: code },
    });
    if (!location) {
      const isCanonical = CANONICAL_LOCATIONS.some((item) => item.code === code);
      if (isCanonical) return code;
      throw new BadRequestException('El código de ubicación no es válido.');
    }
    if (options.requerirActiva && location.Activo === false) {
      throw new BadRequestException(
        'El punto de venta está inactivo.',
      );
    }
    return code;
  }

  private parsearEnteroPositivo(
    value: string | undefined,
    defaultValue: number,
    label: string,
  ): number {
    if (value === undefined || value === null || String(value).trim() === '') {
      return defaultValue;
    }
    const n = Number(String(value).trim());
    if (!Number.isInteger(n) || n < 1) {
      throw new BadRequestException(`El parámetro ${label} no es válido.`);
    }
    return n;
  }

  private parsearFechaIso(value: string, label: string): string {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new BadRequestException(
        `El parámetro ${label} debe tener formato YYYY-MM-DD.`,
      );
    }
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`El parámetro ${label} no es una fecha válida.`);
    }
    return trimmed;
  }

  private siguienteDiaIso(yyyyMmDd: string): string {
    const d = new Date(`${yyyyMmDd}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  }

  private normalizarCodigoEntrada(locationCode: unknown): string {
    if (typeof locationCode !== 'string') {
      throw new BadRequestException('El código de ubicación no es válido.');
    }
    const code = locationCode.trim().toUpperCase();
    if (!LOCATION_CODE_PATTERN.test(code)) {
      throw new BadRequestException('El código de ubicación no es válido.');
    }
    return code;
  }

  private validarCodigoNuevo(locationCode: unknown): string {
    const code = this.normalizarCodigoEntrada(locationCode);
    if (code === BODEGA_CENTRAL) {
      throw new BadRequestException(
        'No se puede usar el código de Bodega Central.',
      );
    }
    if (!code.startsWith('POS_')) {
      throw new BadRequestException(
        'El código del punto de venta debe iniciar con POS_.',
      );
    }
    return code;
  }

  private async generarCodigoUnico(nombre: string): Promise<string> {
    const base = `POS_${nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40)}`;
    const root = base === 'POS_' || base.length < 5 ? 'POS_NUEVO' : base;

    let candidate = root;
    let suffix = 2;
    while (
      await this.locationsRepository.findOne({ where: { Codigo: candidate } })
    ) {
      const suffixText = `_${suffix}`;
      candidate = `${root.slice(0, 49 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
    return candidate;
  }

  private validarNombre(nombre: unknown): string {
    if (typeof nombre !== 'string') {
      throw new BadRequestException('El nombre es obligatorio.');
    }
    const normalized = nombre.trim();
    if (normalized.length < 2 || normalized.length > 100) {
      throw new BadRequestException(
        'El nombre debe tener entre 2 y 100 caracteres.',
      );
    }
    return normalized;
  }

  private validarActivo(activo: unknown): boolean {
    if (typeof activo === 'boolean') return activo;
    if (activo === 'true' || activo === 1 || activo === '1') return true;
    if (activo === 'false' || activo === 0 || activo === '0') return false;
    throw new BadRequestException('El estado activo no es válido.');
  }

  private async registrarAuditoriaUbicacion(
    accion: string,
    idRegistro: number,
    detalle: string,
  ) {
    try {
      await this.dataSource.getRepository(Auditoria).insert({
        Accion: accion,
        Tabla: 'inventario_ubicaciones',
        IdRegistro: String(idRegistro),
        Detalle: detalle,
        Fecha: new Date(),
        IdUsuario: getAuditoriaUserId(),
      });
    } catch {
      // La auditoría no debe bloquear el CRUD de ubicaciones.
    }
  }

  private tomarCampo(
    body: Record<string, unknown>,
    ...keys: string[]
  ): unknown {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(body ?? {}, key)) {
        return body[key];
      }
    }
    return undefined;
  }

  private normalizarIdentidadProducto(value: unknown): string {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return String(value);
    }
    if (typeof value === 'string') return value.trim();
    throw new BadRequestException(
      'El identificador del producto no es válido.',
    );
  }

  private validarCantidadTransferencia(value: unknown): number {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 2147483647
    ) {
      throw new BadRequestException(
        'La cantidad a transferir debe ser un entero mayor a 0.',
      );
    }
    return value;
  }

  private validarNotasTransferencia(value: unknown): string {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string') {
      throw new BadRequestException('Las notas no son válidas.');
    }
    const notas = value.trim();
    if (notas.length > 500) {
      throw new BadRequestException(
        'Las notas no pueden superar 500 caracteres.',
      );
    }
    return notas;
  }

  private async resolverUbicacionDestino(
    manager: EntityManager,
    value: unknown,
  ): Promise<InventarioUbicacion> {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      const byId = await manager.findOne(InventarioUbicacion, {
        where: { Id: value },
      });
      if (!byId) {
        throw new NotFoundException('El punto de venta destino no existe.');
      }
      return byId;
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      const byId = await manager.findOne(InventarioUbicacion, {
        where: { Id: Number(value.trim()) },
      });
      if (!byId) {
        throw new NotFoundException('El punto de venta destino no existe.');
      }
      return byId;
    }
    const code = this.normalizarCodigoEntrada(value);
    const byCode = await manager.findOne(InventarioUbicacion, {
      where: { Codigo: code },
    });
    if (!byCode) {
      throw new NotFoundException('El punto de venta destino no existe.');
    }
    return byCode;
  }

  private validarProductId(productId: unknown): string {
    if (
      typeof productId !== 'string' ||
      !/^\d+$/.test(productId) ||
      BigInt(productId) <= 0n
    ) {
      throw new BadRequestException(
        'El identificador del producto no es válido.',
      );
    }

    return productId;
  }

  private validarStock(stock: unknown): number {
    if (
      typeof stock !== 'number' ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      stock > 2147483647
    ) {
      throw new BadRequestException(
        'La cantidad de stock debe ser un entero entre 0 y 2147483647.',
      );
    }

    return stock;
  }

  private validarReason(reason: unknown): string {
    if (typeof reason !== 'string') {
      throw new BadRequestException('El motivo del ajuste es obligatorio.');
    }

    const normalizedReason = reason.trim();
    if (normalizedReason.length === 0 || normalizedReason.length > 300) {
      throw new BadRequestException(
        'El motivo del ajuste debe tener entre 1 y 300 caracteres.',
      );
    }

    return normalizedReason;
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
