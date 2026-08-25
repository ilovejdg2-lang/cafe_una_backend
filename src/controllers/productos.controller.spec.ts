import { ProductosController } from './productos.controller';

describe('ProductosController central stock', () => {
  const service = {
    actualizarStockCentral: jest.fn(),
  };

  let controller: ProductosController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProductosController(service as never);
    service.actualizarStockCentral.mockResolvedValue({
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

    expect(service.actualizarStockCentral).toHaveBeenCalledWith(
      '1',
      expectedStock,
    );
  });

  it('does not mask an invalid camel-case value with a PascalCase fallback', async () => {
    service.actualizarStockCentral.mockRejectedValueOnce(
      new Error('Invalid stock'),
    );

    await expect(
      controller.actualizarStockCentral('1', { stock: null, Stock: 7 }),
    ).rejects.toBeInstanceOf(Error);

    expect(service.actualizarStockCentral).toHaveBeenCalledWith('1', null);
  });
});
