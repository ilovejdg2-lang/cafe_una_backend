import { ProductosService } from './productos.service';

describe('ProductosService central stock', () => {
  const repo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  let service: ProductosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductosService(repo as never, {} as never);
  });

  it.each([-1, 1.5, 2147483648, 'not-a-number'])(
    'rejects an invalid central stock value: %s',
    async (stock) => {
      await expect(service.actualizarStockCentral('1', stock)).rejects.toThrow(
        'La cantidad de stock central debe ser un entero entre 0 y 2147483647.',
      );
      expect(repo.findOne).not.toHaveBeenCalled();
    },
  );

  it('returns null when the product does not exist', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(
      service.actualizarStockCentral('missing', 4),
    ).resolves.toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('updates central stock and clears featured state at zero', async () => {
    const product = { Id: '1', Stock: 10, EsDestacado: true };
    repo.findOne.mockResolvedValue(product);
    repo.save.mockImplementation(
      (value: { Id: string; Stock: number; EsDestacado: boolean }) => value,
    );

    await expect(service.actualizarStockCentral('1', 0)).resolves.toEqual({
      productId: '1',
      locationCode: 'BODEGA_CENTRAL',
      stock: 0,
    });
    expect(product).toMatchObject({ Stock: 0, EsDestacado: false });
  });
});
