import { ProductosController } from './productos.controller';

describe('ProductosController central stock', () => {
  const inventoryService = {
    actualizarStockCentral: jest.fn(),
  };

  let controller: ProductosController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProductosController(
      {} as never,
      inventoryService as never,
    );
    inventoryService.actualizarStockCentral.mockResolvedValue({
      productId: '1',
      locationCode: 'BODEGA_CENTRAL',
      stock: 7,
    });
  });

  it.each([
    [{ stock: 7 }, 7],
    [{ Stock: 7 }, 7],
  ])('accepts the %s body convention', async (request, expectedStock) => {
    await expect(
      controller.actualizarStockCentral('1', request),
    ).resolves.toEqual({
      productId: '1',
      locationCode: 'BODEGA_CENTRAL',
      stock: 7,
    });

    expect(inventoryService.actualizarStockCentral).toHaveBeenCalledWith(
      '1',
      expectedStock,
    );
  });

  it('does not mask an invalid camel-case value with a PascalCase fallback', async () => {
    inventoryService.actualizarStockCentral.mockRejectedValueOnce(
      new Error('Invalid stock'),
    );

    await expect(
      controller.actualizarStockCentral('1', { stock: null, Stock: 7 }),
    ).rejects.toBeInstanceOf(Error);

    expect(inventoryService.actualizarStockCentral).toHaveBeenCalledWith(
      '1',
      null,
    );
  });

  it('rejects a point-of-sale location in the central compatibility route', async () => {
    await expect(
      controller.actualizarStockCentral('1', {
        stock: 7,
        locationCode: 'POS_FUNA_UNA',
      }),
    ).rejects.toThrow('La ruta de stock central solo admite BODEGA_CENTRAL.');

    expect(inventoryService.actualizarStockCentral).not.toHaveBeenCalled();
  });
});
