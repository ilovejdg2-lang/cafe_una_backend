import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CamelCaseInterceptor } from '../common/camel-case.interceptor';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Transferencia } from '../entities/transferencia.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { InventarioController } from './inventario.controller';
import { InventarioService } from '../services/inventario.service';
import { StockAlertaService } from '../services/stock-alerta.service';
import { DataSource } from 'typeorm';

describe('InventarioController location reads', () => {
  let app: INestApplication;
  let currentRoles = ['Admin'];
  const locationsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((row) => row),
    save: jest.fn(async (rows) => rows),
  };
  const stockRepository = { find: jest.fn(), findOne: jest.fn() };
  const productsRepository = { find: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    currentRoles = ['Admin'];

    const moduleRef = await Test.createTestingModule({
      controllers: [InventarioController],
      providers: [
        InventarioService,
        PermisosGuard,
        {
          provide: getRepositoryToken(InventarioUbicacion),
          useValue: locationsRepository,
        },
        {
          provide: getRepositoryToken(InventarioStockUbicacion),
          useValue: stockRepository,
        },
        {
          provide: getRepositoryToken(Producto),
          useValue: productsRepository,
        },
        {
          provide: getRepositoryToken(Transferencia),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: StockAlertaService,
          useValue: { verificarTrasMovimiento: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
            getRepository: jest.fn(() => ({ insert: jest.fn() })),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: { roles: string[] } };
          };
        }) => {
          context.switchToHttp().getRequest().user = { roles: currentRoles };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new CamelCaseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists inventory locations with the public casing and active flag', async () => {
    locationsRepository.find.mockResolvedValue([
      { Id: 1, Codigo: 'BODEGA_CENTRAL', Nombre: 'Bodega Central', Activo: true },
      { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA', Activo: true },
      { Id: 3, Codigo: 'POS_EDITORIAL', Nombre: 'Editorial', Activo: true },
      { Id: 4, Codigo: 'POS_STAND_FERIAS', Nombre: 'Stand Ferias', Activo: false },
    ]);

    await request(app.getHttpServer())
      .get('/api/inventario/ubicaciones')
      .expect(200)
      .expect([
        { id: 1, code: 'BODEGA_CENTRAL', name: 'Bodega Central', activo: true },
        { id: 2, code: 'POS_FUNA_UNA', name: 'FUNA-UNA', activo: true },
        { id: 3, code: 'POS_EDITORIAL', name: 'Editorial', activo: true },
        { id: 4, code: 'POS_STAND_FERIAS', name: 'Stand Ferias', activo: false },
      ]);
  });

  it('rejects location reads with a 403 when the permission is missing', async () => {
    currentRoles = ['Cliente'];

    await request(app.getHttpServer())
      .get('/api/inventario/ubicaciones')
      .expect(403);

    expect(locationsRepository.find).not.toHaveBeenCalled();
  });

  it('returns the selected location balances in one bulk response', async () => {
    locationsRepository.findOne.mockResolvedValue({
      Id: 3,
      Codigo: 'POS_EDITORIAL',
    });
    productsRepository.find.mockResolvedValue([{ Id: '1' }, { Id: '2' }]);
    stockRepository.find.mockResolvedValue([
      { ProductoId: '1', UbicacionId: 3, Stock: 12 },
    ]);

    await request(app.getHttpServer())
      .get('/api/inventario/stock')
      .query({ locationCode: 'POS_EDITORIAL' })
      .expect(200)
      .expect([
        {
          productId: '1',
          locationCode: 'POS_EDITORIAL',
          stock: 12,
          provisioned: true,
        },
        {
          productId: '2',
          locationCode: 'POS_EDITORIAL',
          stock: 0,
          provisioned: false,
        },
      ]);

    expect(productsRepository.find).toHaveBeenCalledWith({
      order: { Id: 'ASC' },
    });
    expect(stockRepository.find).toHaveBeenCalledWith({
      where: { UbicacionId: 3 },
    });
    expect(productsRepository.findOne).not.toHaveBeenCalled();
    expect(stockRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects an invalid bulk location with HTTP 400', async () => {
    locationsRepository.findOne.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/api/inventario/stock')
      .query({ locationCode: 'POS_DESCONOCIDO' })
      .expect(400);

    expect(productsRepository.find).not.toHaveBeenCalled();
    expect(stockRepository.find).not.toHaveBeenCalled();
  });

  it('rejects an unknown location code without mutating repositories', async () => {
    locationsRepository.findOne.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/api/inventario/productos/1/stock')
      .query({ locationCode: 'POS_DESCONOCIDO' })
      .expect(400);

    expect(productsRepository.findOne).not.toHaveBeenCalled();
    expect(stockRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns an absent balance as zero and unprovisioned', async () => {
    productsRepository.findOne.mockResolvedValue({ Id: '1' });
    locationsRepository.findOne.mockResolvedValue({
      Id: 2,
      Codigo: 'POS_FUNA_UNA',
    });
    stockRepository.findOne.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/api/inventario/productos/1/stock')
      .query({ locationCode: 'POS_FUNA_UNA' })
      .expect(200)
      .expect({
        productId: '1',
        locationCode: 'POS_FUNA_UNA',
        stock: 0,
        provisioned: false,
      });

    expect(stockRepository.findOne).toHaveBeenCalled();
  });

  it('returns a persisted zero as provisioned without exposing another location', async () => {
    productsRepository.findOne.mockResolvedValue({ Id: '1' });
    locationsRepository.findOne.mockResolvedValue({
      Id: 2,
      Codigo: 'POS_FUNA_UNA',
    });
    stockRepository.findOne.mockResolvedValue({
      ProductoId: '1',
      UbicacionId: 2,
      Stock: 0,
    });

    await request(app.getHttpServer())
      .get('/api/inventario/productos/1/stock')
      .query({ locationCode: 'POS_FUNA_UNA' })
      .expect(200)
      .expect({
        productId: '1',
        locationCode: 'POS_FUNA_UNA',
        stock: 0,
        provisioned: true,
      });

    expect(stockRepository.findOne).toHaveBeenCalled();
  });

  it('returns only the selected location balance when another location has stock', async () => {
    productsRepository.findOne.mockResolvedValue({ Id: '1' });
    locationsRepository.findOne.mockResolvedValue({
      Id: 3,
      Codigo: 'POS_EDITORIAL',
    });
    stockRepository.findOne.mockResolvedValue({
      ProductoId: '1',
      UbicacionId: 3,
      Stock: 12,
    });

    await request(app.getHttpServer())
      .get('/api/inventario/productos/1/stock')
      .query({ locationCode: 'POS_EDITORIAL' })
      .expect(200)
      .expect({
        productId: '1',
        locationCode: 'POS_EDITORIAL',
        stock: 12,
        provisioned: true,
      });

    expect(stockRepository.findOne).toHaveBeenCalledWith({
      where: { ProductoId: '1', UbicacionId: 3 },
    });
  });

  it('rejects physical deletion of locations and allows authenticated create', async () => {
    locationsRepository.findOne.mockResolvedValue(null);
    locationsRepository.save.mockImplementation(async (row) => ({
      Id: 9,
      ...row,
    }));

    await request(app.getHttpServer())
      .delete('/api/inventario/ubicaciones')
      .expect(404);

    await request(app.getHttpServer())
      .post('/api/inventario/ubicaciones')
      .send({ nombre: 'Kiosco Norte' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'Kiosco Norte',
          activo: true,
        });
        expect(body.code).toMatch(/^POS_/);
      });
  });

  it('blocks editing Bodega Central', async () => {
    await request(app.getHttpServer())
      .put('/api/inventario/ubicaciones/BODEGA_CENTRAL')
      .send({ nombre: 'Otra' })
      .expect(400);
  });

  it('rejects location stock adjustments when the administrator permission is missing', async () => {
    currentRoles = ['Cliente'];

    await request(app.getHttpServer())
      .put('/api/inventario/ubicaciones/POS_EDITORIAL/productos/1/stock')
      .send({ stock: 12, reason: 'Carga inicial' })
      .expect(403);

    expect(stockRepository.findOne).not.toHaveBeenCalled();
  });

  it('adjusts a location balance using the public request contract', async () => {
    const queryRunner = {
      manager: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ Id: 3, Codigo: 'POS_EDITORIAL' })
          .mockResolvedValueOnce({ Id: '1', Stock: 10 })
          .mockResolvedValueOnce({
            Id: '7',
            ProductoId: '1',
            UbicacionId: 3,
            Stock: 0,
          }),
        save: jest.fn(),
        insert: jest.fn(),
      },
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
    };
    const dataSource = app.get(DataSource);
    jest
      .spyOn(dataSource, 'createQueryRunner')
      .mockReturnValue(queryRunner as never);

    await request(app.getHttpServer())
      .put('/api/inventario/ubicaciones/POS_EDITORIAL/productos/1/stock')
      .send({ Stock: 12, Reason: 'Carga inicial del punto de venta' })
      .expect(200)
      .expect({
        productId: '1',
        locationCode: 'POS_EDITORIAL',
        previousStock: 0,
        stock: 12,
        reason: 'Carga inicial del punto de venta',
      });

    expect(queryRunner.manager.insert).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });
});
