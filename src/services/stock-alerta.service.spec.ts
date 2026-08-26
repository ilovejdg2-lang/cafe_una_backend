import { StockAlertaService } from './stock-alerta.service';

describe('StockAlertaService', () => {
  const productosRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (row) => row),
    find: jest.fn(),
  };
  const stockRepo = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => row),
  };
  const ubicacionesRepo = {
    findOne: jest.fn(),
  };
  const usuariosRepo = { find: jest.fn() };
  const emailService = { enviarAlertaStockBajo: jest.fn().mockResolvedValue(true) };

  let service: StockAlertaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StockAlertaService(
      productosRepo as never,
      stockRepo as never,
      ubicacionesRepo as never,
      usuariosRepo as never,
      emailService as never,
    );
    ubicacionesRepo.findOne.mockResolvedValue({ Id: 1, Codigo: 'BODEGA_CENTRAL' });
    stockRepo.findOne.mockResolvedValue({
      Id: '10',
      ProductoId: '9',
      UbicacionId: 1,
      Stock: 2,
    });
  });

  it('sets alerta and emails SuperAdmin when stock falls to minimum', async () => {
    productosRepo.findOne.mockResolvedValue({
      Id: '9',
      Nombre: 'Café',
      Stock: 5,
      StockMinimo: 5,
      AlertaStock: false,
      Disponible: true,
      EsDestacado: true,
    });
    stockRepo.findOne.mockResolvedValue({
      Id: '10',
      ProductoId: '9',
      UbicacionId: 1,
      Stock: 5,
    });
    stockRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '5' }),
    });
    stockRepo.count.mockResolvedValue(1);
    usuariosRepo.find.mockResolvedValue([
      {
        Nombre: 'Samir',
        Correo: 'sa@una.cr',
        Estado: 'activo',
        Roles: ['SuperAdmin'],
      },
    ]);

    await service.verificarTrasMovimiento('9');

    expect(productosRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        AlertaStock: true,
        Disponible: true,
        EsDestacado: true,
      }),
    );
    expect(emailService.enviarAlertaStockBajo).toHaveBeenCalledWith(
      'sa@una.cr',
      expect.objectContaining({
        nombreProducto: 'Café',
        stockActual: 5,
        stockMinimo: 5,
      }),
    );
  });

  it('reconciles Bodega Central to productos.Stock before alerting', async () => {
    productosRepo.findOne.mockResolvedValue({
      Id: '9',
      Nombre: 'Café',
      Stock: 4,
      StockMinimo: 5,
      AlertaStock: false,
      Disponible: true,
      EsDestacado: true,
    });
    stockRepo.findOne.mockResolvedValue({
      Id: '10',
      ProductoId: '9',
      UbicacionId: 1,
      Stock: 8,
    });
    stockRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '4' }),
    });
    stockRepo.count.mockResolvedValue(1);
    usuariosRepo.find.mockResolvedValue([]);

    await service.verificarTrasMovimiento('9');

    expect(stockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ Stock: 4 }),
    );
    expect(productosRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ AlertaStock: true }),
    );
  });

  it('marks unavailable and clears featured when stock is 0', async () => {
    productosRepo.findOne.mockResolvedValue({
      Id: '9',
      Nombre: 'Café',
      Stock: 0,
      StockMinimo: 0,
      AlertaStock: false,
      Disponible: true,
      EsDestacado: true,
    });
    stockRepo.findOne.mockResolvedValue({
      Id: '10',
      ProductoId: '9',
      UbicacionId: 1,
      Stock: 0,
    });
    stockRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    });
    stockRepo.count.mockResolvedValue(1);
    usuariosRepo.find.mockResolvedValue([]);

    await service.verificarTrasMovimiento('9');

    expect(productosRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        AlertaStock: true,
        Disponible: false,
        EsDestacado: false,
      }),
    );
  });
});
