import { DataSource } from 'typeorm';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { InventarioService } from './inventario.service';

describe('InventarioService central stock compatibility', () => {
  const locationsRepository = { findOne: jest.fn() };
  const stockRepository = { findOne: jest.fn() };
  const productsRepository = { findOne: jest.fn() };
  const queryRunner = {
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
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
});
