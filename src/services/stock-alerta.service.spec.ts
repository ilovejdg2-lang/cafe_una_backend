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
    find: jest.fn(),
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => row),
  };
  const ubicacionesRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const usuariosRepo = { find: jest.fn() };
  const emailService = { enviarAlertaStockBajo: jest.fn().mockResolvedValue(true) };

  let service: StockAlertaService;

  const ubicacionesActivas = [
    { Id: 1, Codigo: 'BODEGA_CENTRAL', Nombre: 'Bodega Central', Activo: true },
    { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA', Activo: true },
    { Id: 3, Codigo: 'POS_EDITORIAL', Nombre: 'Editorial', Activo: true },
    { Id: 4, Codigo: 'POS_STAND_FERIAS', Nombre: 'Stand Ferias', Activo: true },
  ];

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
    ubicacionesRepo.find.mockResolvedValue(ubicacionesActivas);
    stockRepo.findOne.mockResolvedValue({
      Id: '10',
      ProductoId: '9',
      UbicacionId: 1,
      Stock: 2,
    });
    stockRepo.find.mockResolvedValue([
      { ProductoId: '9', UbicacionId: 1, Stock: 5 },
    ]);
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

  it('alerts when any point of sale is at or below minimum even if central is fine', async () => {
    productosRepo.findOne.mockResolvedValue({
      Id: '9',
      Nombre: 'Café',
      Stock: 40,
      StockMinimo: 5,
      AlertaStock: false,
      Disponible: true,
      EsDestacado: true,
    });
    stockRepo.findOne.mockResolvedValue({
      Id: '10',
      ProductoId: '9',
      UbicacionId: 1,
      Stock: 40,
    });
    stockRepo.find.mockResolvedValue([
      { ProductoId: '9', UbicacionId: 1, Stock: 40 },
      { ProductoId: '9', UbicacionId: 3, Stock: 2 },
    ]);
    stockRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '42' }),
    });
    stockRepo.count.mockResolvedValue(2);
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
      expect.objectContaining({ AlertaStock: true }),
    );
    expect(emailService.enviarAlertaStockBajo).toHaveBeenCalledWith(
      'sa@una.cr',
      expect.objectContaining({
        stockActual: 2,
        ubicacionNombre: expect.stringContaining('Editorial'),
      }),
    );
  });

  it('does not alert for Stand Ferias stock alone', async () => {
    productosRepo.find.mockResolvedValue([
      {
        Id: '9',
        Nombre: 'Café',
        Stock: 40,
        StockMinimo: 5,
      },
    ]);
    stockRepo.find.mockResolvedValue([
      { ProductoId: '9', UbicacionId: 1, Stock: 40 },
      { ProductoId: '9', UbicacionId: 4, Stock: 1 },
    ]);

    const alertas = await service.listarAlertas();

    expect(alertas).toHaveLength(0);
  });

  it('lists alerts with low point-of-sale locations', async () => {
    productosRepo.find.mockResolvedValue([
      {
        Id: '9',
        Nombre: 'Café',
        Stock: 40,
        StockMinimo: 5,
      },
    ]);
    stockRepo.find.mockResolvedValue([
      { ProductoId: '9', UbicacionId: 1, Stock: 40 },
      { ProductoId: '9', UbicacionId: 2, Stock: 1 },
    ]);

    const alertas = await service.listarAlertas();

    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      id: '9',
      stockActual: 1,
      stockMinimo: 5,
    });
    expect(alertas[0].ubicaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'POS_FUNA_UNA', stock: 1 }),
      ]),
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
