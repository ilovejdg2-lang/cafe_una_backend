import { DataSource } from 'typeorm';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Usuario } from '../entities/usuario.entity';
import { InventarioService } from './inventario.service';

type SalidaInventarioApi = {
  registrarSalida(
    body: Record<string, unknown>,
    responsableId: number | null,
  ): Promise<Record<string, unknown>>;
};

describe('InventarioService.registrarSalida', () => {
  const locationsRepository = { find: jest.fn(), findOne: jest.fn() };
  const stockRepository = { find: jest.fn(), findOne: jest.fn() };
  const productsRepository = { find: jest.fn(), findOne: jest.fn() };
  const balance = { Id: '5', ProductoId: '101', UbicacionId: 1, Stock: 8 };
  const product = { Id: '101', Nombre: 'Café de altura', Stock: 8 };
  const central = { Id: 1, Codigo: 'BODEGA_CENTRAL', Nombre: 'Bodega Central' };
  const reason = { Id: 2, Nombre: 'Donación' };
  const manager = {
    findOne: jest.fn(),
    create: jest.fn((_entity: unknown, row: Record<string, unknown>) => row),
    save: jest.fn(async (row: Record<string, unknown>) => row),
  };
  const queryRunner = {
    manager,
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
  const stockAlerts = { verificarTrasMovimiento: jest.fn().mockResolvedValue(null) };
  let service: SalidaInventarioApi;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.save.mockImplementation(async (row: Record<string, unknown>) => row);
    balance.Stock = 8;
    product.Stock = 8;
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === InventarioUbicacion) return central;
      if (entity === Producto) return product;
      if (entity === InventarioStockUbicacion) return balance;
      if (entity === Usuario) return null;
      return reason;
    });
    service = new InventarioService(
      locationsRepository as never,
      stockRepository as never,
      productsRepository as never,
      { createQueryBuilder: jest.fn() } as never,
      dataSource as unknown as DataSource,
      stockAlerts as never,
    ) as unknown as SalidaInventarioApi;
  });

  it('decrements central and legacy stock and records a classified outbound movement atomically', async () => {
    await expect(
      service.registrarSalida(
        {
          productoId: '101',
          cantidad: 3,
          motivoSalidaId: 2,
          destinatario: 'Fundación Café UNA',
        },
        44,
      ),
    ).resolves.toMatchObject({
      productoId: '101',
      cantidad: 3,
      motivoSalidaId: 2,
      destinatario: 'Fundación Café UNA',
      stockRestante: 5,
    });

    expect(balance.Stock).toBe(5);
    expect(product.Stock).toBe(5);
    expect(manager.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        Tipo: 'salida_bodega',
        ProductoId: '101',
        Cantidad: 3,
        MotivoSalidaId: 2,
        Destinatario: 'Fundación Café UNA',
        ResponsableId: 44,
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(stockAlerts.verificarTrasMovimiento).toHaveBeenCalledWith('101');
  });

  it('returns the committed exit when the post-commit stock alert fails', async () => {
    stockAlerts.verificarTrasMovimiento.mockRejectedValueOnce(
      new Error('alert delivery failed'),
    );

    await expect(
      service.registrarSalida(
        {
          productoId: '101',
          cantidad: 2,
          motivoSalidaId: 2,
          destinatario: 'Fundación Café UNA',
        },
        44,
      ),
    ).resolves.toMatchObject({
      productoId: '101',
      cantidad: 2,
      motivoSalidaId: 2,
      destinatario: 'Fundación Café UNA',
      stockRestante: 6,
    });

    expect(balance.Stock).toBe(6);
    expect(product.Stock).toBe(6);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(stockAlerts.verificarTrasMovimiento).toHaveBeenCalledWith('101');
  });

  it.each([
    ['Donación', 2],
    ['Traslado', 3],
  ])('requires a recipient for %s', async (name, reasonId) => {
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === InventarioUbicacion) return central;
      if (entity === Producto) return product;
      if (entity === InventarioStockUbicacion) return balance;
      if (entity === Usuario) return null;
      return { Id: reasonId, Nombre: name };
    });

    await expect(
      service.registrarSalida(
        { productoId: '101', cantidad: 1, motivoSalidaId: reasonId },
        44,
      ),
    ).rejects.toThrow(/destinatario/i);

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects an unknown reason without changing stock', async () => {
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === InventarioUbicacion) return central;
      if (entity === Producto) return product;
      if (entity === InventarioStockUbicacion) return balance;
      if (entity === Usuario) return null;
      return null;
    });

    await expect(
      service.registrarSalida(
        { productoId: '101', cantidad: 1, motivoSalidaId: 999 },
        44,
      ),
    ).rejects.toThrow();

    expect(balance.Stock).toBe(8);
    expect(product.Stock).toBe(8);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('does not commit or create a movement when central stock is insufficient', async () => {
    balance.Stock = 2;
    product.Stock = 2;

    await expect(
      service.registrarSalida(
        {
          productoId: '101',
          cantidad: 3,
          motivoSalidaId: 1,
          destinatario: 'Punto de venta',
        },
        44,
      ),
    ).rejects.toThrow(/stock suficiente/i);

    expect(manager.save).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('rolls back both stock representations if ledger persistence fails', async () => {
    manager.save.mockImplementation(async (row: Record<string, unknown>) => {
      if (row.Tipo === 'salida_bodega') {
        throw new Error('movement write failed');
      }
      return row;
    });

    await expect(
      service.registrarSalida(
        {
          productoId: '101',
          cantidad: 1,
          motivoSalidaId: 1,
          destinatario: 'Punto de venta',
        },
        44,
      ),
    ).rejects.toThrow('movement write failed');

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('allows a recipient-free sale reason', async () => {
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === InventarioUbicacion) return central;
      if (entity === Producto) return product;
      if (entity === InventarioStockUbicacion) return balance;
      if (entity === Usuario) return null;
      return { Id: 1, Nombre: 'Venta' };
    });

    await expect(
      service.registrarSalida(
        { productoId: '101', cantidad: 1, motivoSalidaId: 1 },
        44,
      ),
    ).resolves.toMatchObject({ motivoSalida: 'Venta', destinatario: null });
  });

  it('lists stable catalog IDs and labels for the admin form', async () => {
    const getRepository = jest.fn(() => ({
      find: jest.fn().mockResolvedValue([
        { Id: 1, Nombre: 'Venta' },
        { Id: 2, Nombre: 'Donación' },
      ]),
    }));
    service = new InventarioService(
      locationsRepository as never,
      stockRepository as never,
      productsRepository as never,
      { createQueryBuilder: jest.fn() } as never,
      { getRepository } as unknown as DataSource,
      stockAlerts as never,
    ) as unknown as SalidaInventarioApi & {
      listarMotivosSalida(): Promise<Array<{ id: number; nombre: string }>>;
    };

    await expect(service.listarMotivosSalida()).resolves.toEqual([
      { id: 1, nombre: 'Venta' },
      { id: 2, nombre: 'Donación' },
    ]);
  });
});
