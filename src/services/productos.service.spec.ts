import { ProductosService } from './productos.service';

describe('ProductosService central stock', () => {
  const repo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const inventarioService = {
    actualizarStockCentral: jest.fn(),
  };

  let service: ProductosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductosService(
      repo as never,
      {} as never,
      {} as never,
      inventarioService as never,
      { verificarTrasMovimiento: jest.fn() } as never,
    );
  });

  it.each([-1, 1.5, 2147483648, '4', '', null, true, 'not-a-number'])(
    'rejects an invalid central stock value: %s',
    async (stock) => {
      inventarioService.actualizarStockCentral.mockRejectedValue(
        new Error(
          'La cantidad de stock central debe ser un entero entre 0 y 2147483647.',
        ),
      );
      await expect(service.actualizarStockCentral('1', stock)).rejects.toThrow(
        'La cantidad de stock central debe ser un entero entre 0 y 2147483647.',
      );
      expect(inventarioService.actualizarStockCentral).toHaveBeenCalledWith(
        '1',
        stock,
      );
    },
  );

  it('returns null when the product does not exist', async () => {
    inventarioService.actualizarStockCentral.mockResolvedValue(null);

    await expect(
      service.actualizarStockCentral('missing', 4),
    ).resolves.toBeNull();
    expect(inventarioService.actualizarStockCentral).toHaveBeenCalledWith(
      'missing',
      4,
    );
  });

  it('delegates central stock update to InventarioService', async () => {
    inventarioService.actualizarStockCentral.mockResolvedValue({
      productId: '1',
      locationCode: 'BODEGA_CENTRAL',
      stock: 0,
    });

    await expect(service.actualizarStockCentral('1', 0)).resolves.toEqual({
      productId: '1',
      locationCode: 'BODEGA_CENTRAL',
      stock: 0,
    });
    expect(inventarioService.actualizarStockCentral).toHaveBeenCalledWith(
      '1',
      0,
    );
  });
});
