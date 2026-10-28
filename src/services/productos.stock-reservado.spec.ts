import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { ProductosService } from './productos.service';

describe('ProductosService.ajustarStock reservations', () => {
  const manager = {
    findOne: jest.fn(),
    create: jest.fn((_entity: unknown, row: Record<string, unknown>) => row),
    save: jest.fn(),
  };
  const queryRunner = {
    manager,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  let service: ProductosService;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.save.mockImplementation(
      async (row: Record<string, unknown>) => row,
    );
    service = new ProductosService(
      {} as never,
      dataSource as never,
      {} as never,
      {} as never,
      { verificarTrasMovimiento: jest.fn() } as never,
    );
  });

  it('rejects a bulk stock adjustment that would consume reserved quantity', async () => {
    const product = {
      Id: '101',
      Nombre: 'Café',
      Estado: 'Habilitado',
      Stock: 10,
    };
    const balance = {
      ProductoId: '101',
      UbicacionId: 1,
      Stock: 10,
      StockReservado: 7,
    };
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Producto) return product;
      if (entity === InventarioUbicacion) {
        return { Id: 1, Codigo: 'BODEGA_CENTRAL' };
      }
      if (entity === InventarioStockUbicacion) return balance;
      return null;
    });

    await expect(
      service.ajustarStock([{ Id: '101', Units: 4 }]),
    ).rejects.toThrow(/stock suficiente/i);

    expect(balance.Stock).toBe(10);
    expect(manager.save).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });
});
