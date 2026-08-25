import { DataSource } from 'typeorm';
import { InventarioService } from './inventario.service';

describe('InventarioService bulk location stock reads', () => {
  const locationsRepository = { findOne: jest.fn() };
  const stockRepository = { find: jest.fn(), findOne: jest.fn() };
  const productsRepository = { find: jest.fn(), findOne: jest.fn() };
  const dataSource = { createQueryRunner: jest.fn() };

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

  it.each([
    'BODEGA_CENTRAL',
    'POS_FUNA_UNA',
    'POS_EDITORIAL',
    'POS_STAND_FERIAS',
  ])('accepts the canonical location code %s', async (locationCode) => {
    locationsRepository.findOne.mockResolvedValue({
      Id: 2,
      Codigo: locationCode,
    });
    productsRepository.find.mockResolvedValue([{ Id: '1' }]);
    stockRepository.find.mockResolvedValue([]);

    await expect(
      service.obtenerStockPorUbicacion(locationCode),
    ).resolves.toEqual([
      {
        productId: '1',
        locationCode,
        stock: 0,
        provisioned: false,
      },
    ]);

    expect(locationsRepository.findOne).toHaveBeenCalledWith({
      where: { Codigo: locationCode },
    });
  });

  it('rejects an invalid code before querying repositories', async () => {
    await expect(
      service.obtenerStockPorUbicacion('POS_DESCONOCIDO'),
    ).rejects.toThrow('El código de ubicación no es válido.');

    expect(locationsRepository.findOne).not.toHaveBeenCalled();
    expect(productsRepository.find).not.toHaveBeenCalled();
    expect(stockRepository.find).not.toHaveBeenCalled();
  });

  it('returns a product row for absent, explicit-zero, and selected-location balances', async () => {
    locationsRepository.findOne.mockResolvedValue({
      Id: 2,
      Codigo: 'POS_FUNA_UNA',
    });
    productsRepository.find.mockResolvedValue([
      { Id: '1' },
      { Id: '2' },
      { Id: '3' },
    ]);
    stockRepository.find.mockResolvedValue([
      { ProductoId: '2', UbicacionId: 2, Stock: 0 },
      { ProductoId: '3', UbicacionId: 2, Stock: 12 },
      { ProductoId: '3', UbicacionId: 1, Stock: 99 },
    ]);

    await expect(
      service.obtenerStockPorUbicacion('POS_FUNA_UNA'),
    ).resolves.toEqual([
      {
        productId: '1',
        locationCode: 'POS_FUNA_UNA',
        stock: 0,
        provisioned: false,
      },
      {
        productId: '2',
        locationCode: 'POS_FUNA_UNA',
        stock: 0,
        provisioned: true,
      },
      {
        productId: '3',
        locationCode: 'POS_FUNA_UNA',
        stock: 12,
        provisioned: true,
      },
    ]);

    expect(productsRepository.find).toHaveBeenCalledTimes(1);
    expect(productsRepository.find).toHaveBeenCalledWith({
      order: { Id: 'ASC' },
    });
    expect(stockRepository.find).toHaveBeenCalledTimes(1);
    expect(stockRepository.find).toHaveBeenCalledWith({
      where: { UbicacionId: 2 },
    });
    expect(productsRepository.findOne).not.toHaveBeenCalled();
    expect(stockRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns no balances without an unnecessary stock query when there are no products', async () => {
    locationsRepository.findOne.mockResolvedValue({
      Id: 2,
      Codigo: 'POS_FUNA_UNA',
    });
    productsRepository.find.mockResolvedValue([]);

    await expect(
      service.obtenerStockPorUbicacion('POS_FUNA_UNA'),
    ).resolves.toEqual([]);

    expect(stockRepository.find).not.toHaveBeenCalled();
  });

  it('returns 404 when the canonical location is not initialized', async () => {
    locationsRepository.findOne.mockResolvedValue(null);

    await expect(
      service.obtenerStockPorUbicacion('POS_FUNA_UNA'),
    ).rejects.toThrow('La ubicación de inventario no está inicializada.');

    expect(productsRepository.find).not.toHaveBeenCalled();
    expect(stockRepository.find).not.toHaveBeenCalled();
  });
});
