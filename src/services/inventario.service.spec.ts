import { DataSource } from 'typeorm';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { InventarioService } from './inventario.service';

describe('InventarioService central stock compatibility', () => {
  const locationsRepository = { find: jest.fn(), findOne: jest.fn() };
  const stockRepository = { find: jest.fn(), findOne: jest.fn() };
  const productsRepository = { find: jest.fn(), findOne: jest.fn() };
  const queryRunner = {
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
      insert: jest.fn(),
    },
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isTransactionActive: true,
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };

  let service: InventarioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InventarioService(
      locationsRepository as never,
      stockRepository as never,
      productsRepository as never,
      dataSource as unknown as DataSource,
    );
  });

  it.each([-1, 1.5, 2147483648, '4', '', null, true, NaN])(
    'rejects strict central stock value: %s',
    async (stock) => {
      await expect(service.actualizarStockCentral('1', stock)).rejects.toThrow(
        'La cantidad de stock central debe ser un entero entre 0 y 2147483647.',
      );

      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    },
  );

  it('returns null for a missing product without saving either representation', async () => {
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ Id: 1, Codigo: 'BODEGA_CENTRAL' })
      .mockResolvedValueOnce(null);

    await expect(
      service.actualizarStockCentral('missing', 4),
    ).resolves.toBeNull();

    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('updates central balance and legacy product stock atomically', async () => {
    const product = { Id: '1', Stock: 10, EsDestacado: true };
    const balance = {
      ProductoId: '1',
      UbicacionId: 1,
      Stock: 10,
    };
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ Id: 1, Codigo: 'BODEGA_CENTRAL' })
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(balance);
    queryRunner.manager.save
      .mockResolvedValueOnce(balance)
      .mockResolvedValueOnce(product);

    await expect(service.actualizarStockCentral('1', 0)).resolves.toEqual({
      productId: '1',
      locationCode: 'BODEGA_CENTRAL',
      stock: 0,
    });

    expect(balance.Stock).toBe(0);
    expect(product).toMatchObject({ Stock: 0, EsDestacado: false });
    expect(queryRunner.manager.save).toHaveBeenCalledTimes(2);
    expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(
      1,
      InventarioUbicacion,
      { where: { Codigo: 'BODEGA_CENTRAL' } },
    );
    expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(
      2,
      Producto,
      expect.objectContaining({
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(
      3,
      InventarioStockUbicacion,
      expect.objectContaining({
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rolls back when the second representation cannot be saved', async () => {
    const product = { Id: '1', Stock: 10, EsDestacado: true };
    const balance = { ProductoId: '1', UbicacionId: 1, Stock: 10 };
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ Id: 1, Codigo: 'BODEGA_CENTRAL' })
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(balance);
    queryRunner.manager.save
      .mockResolvedValueOnce(balance)
      .mockRejectedValueOnce(new Error('database failure'));

    await expect(service.actualizarStockCentral('1', 7)).rejects.toThrow(
      'database failure',
    );

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('returns one scoped balance per product without issuing product-level stock queries', async () => {
    locationsRepository.findOne.mockResolvedValue({
      Id: 3,
      Codigo: 'POS_EDITORIAL',
    });
    productsRepository.find.mockResolvedValue([
      { Id: '1', Nombre: 'Café 1' },
      { Id: '2', Nombre: 'Café 2' },
    ]);
    stockRepository.find.mockResolvedValue([
      { ProductoId: '1', UbicacionId: 3, Stock: 0 },
    ]);

    await expect(
      service.obtenerStockPorUbicacion('POS_EDITORIAL'),
    ).resolves.toEqual([
      {
        productId: '1',
        locationCode: 'POS_EDITORIAL',
        stock: 0,
        provisioned: true,
      },
      {
        productId: '2',
        locationCode: 'POS_EDITORIAL',
        stock: 0,
        provisioned: false,
      },
    ]);

    expect(productsRepository.find).toHaveBeenCalledWith({
      order: { Id: 'ASC' },
    });
    expect(stockRepository.find).toHaveBeenCalledWith({
      where: { UbicacionId: 3 },
    });
    expect(productsRepository.findOne).not.toHaveBeenCalled();
    expect(stockRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects an invalid bulk location before querying repositories', async () => {
    await expect(
      service.obtenerStockPorUbicacion('POS_DESCONOCIDO'),
    ).rejects.toThrow('El código de ubicación no es válido.');

    expect(locationsRepository.findOne).not.toHaveBeenCalled();
    expect(productsRepository.find).not.toHaveBeenCalled();
    expect(stockRepository.find).not.toHaveBeenCalled();
  });

  it('fails when the requested location is not initialized', async () => {
    locationsRepository.findOne.mockResolvedValue(null);

    await expect(
      service.obtenerStockPorUbicacion('POS_EDITORIAL'),
    ).rejects.toThrow('La ubicación de inventario no está inicializada.');

    expect(productsRepository.find).not.toHaveBeenCalled();
    expect(stockRepository.find).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, 2147483648, '4', '', null, true, NaN])(
    'rejects strict location stock value: %s',
    async (stock) => {
      await expect(
        service.ajustarStockUbicacion(
          'POS_EDITORIAL',
          '1',
          stock,
          'Carga inicial',
        ),
      ).rejects.toThrow(
        'La cantidad de stock debe ser un entero entre 0 y 2147483647.',
      );

      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    },
  );

  it('updates a POS balance and records its audit entry atomically', async () => {
    const product = { Id: '1', Stock: 10 };
    const balance = {
      Id: '7',
      ProductoId: '1',
      UbicacionId: 3,
      Stock: 0,
    };
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ Id: 3, Codigo: 'POS_EDITORIAL' })
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(balance);

    await expect(
      service.ajustarStockUbicacion(
        'POS_EDITORIAL',
        '1',
        12,
        'Carga inicial del punto de venta',
      ),
    ).resolves.toEqual({
      productId: '1',
      locationCode: 'POS_EDITORIAL',
      previousStock: 0,
      stock: 12,
      reason: 'Carga inicial del punto de venta',
    });

    expect(balance.Stock).toBe(12);
    expect(product.Stock).toBe(10);
    expect(queryRunner.manager.save).toHaveBeenCalledWith(balance);
    expect(queryRunner.manager.insert).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not expose the central stock through the POS adjustment route', async () => {
    await expect(
      service.ajustarStockUbicacion('BODEGA_CENTRAL', '1', 12, 'Corrección'),
    ).rejects.toThrow('La ruta de ajustes solo admite puntos de venta.');

    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('does not write an audit row when the requested stock is unchanged', async () => {
    const balance = {
      Id: '7',
      ProductoId: '1',
      UbicacionId: 3,
      Stock: 12,
    };
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ Id: 3, Codigo: 'POS_EDITORIAL' })
      .mockResolvedValueOnce({ Id: '1', Stock: 10 })
      .mockResolvedValueOnce(balance);

    await expect(
      service.ajustarStockUbicacion('POS_EDITORIAL', '1', 12, 'Verificación'),
    ).resolves.toMatchObject({ previousStock: 12, stock: 12 });

    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(queryRunner.manager.insert).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty adjustment reason before opening a transaction', async () => {
    await expect(
      service.ajustarStockUbicacion('POS_EDITORIAL', '1', 12, '   '),
    ).rejects.toThrow(
      'El motivo del ajuste debe tener entre 1 y 300 caracteres.',
    );

    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('rolls back the POS balance when the audit insert fails', async () => {
    const balance = {
      Id: '7',
      ProductoId: '1',
      UbicacionId: 3,
      Stock: 0,
    };
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ Id: 3, Codigo: 'POS_EDITORIAL' })
      .mockResolvedValueOnce({ Id: '1', Stock: 10 })
      .mockResolvedValueOnce(balance);
    queryRunner.manager.insert.mockRejectedValueOnce(
      new Error('audit failure'),
    );

    await expect(
      service.ajustarStockUbicacion('POS_EDITORIAL', '1', 12, 'Corrección'),
    ).rejects.toThrow('audit failure');

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
