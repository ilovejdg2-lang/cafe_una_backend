import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CamelCaseInterceptor } from '../common/camel-case.interceptor';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { InventarioController } from './inventario.controller';
import { InventarioService } from '../services/inventario.service';
import { DataSource } from 'typeorm';

describe('InventarioController location reads', () => {
  let app: INestApplication;
  let currentRoles = ['Admin'];
  const locationsRepository = { find: jest.fn(), findOne: jest.fn() };
  const stockRepository = { findOne: jest.fn() };
  const productsRepository = { findOne: jest.fn() };

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
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn() },
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

  it('lists the four canonical locations with the public casing', async () => {
    locationsRepository.find.mockResolvedValue([
      { Id: 1, Codigo: 'BODEGA_CENTRAL', Nombre: 'Bodega Central' },
      { Id: 2, Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA' },
      { Id: 3, Codigo: 'POS_EDITORIAL', Nombre: 'Editorial' },
      { Id: 4, Codigo: 'POS_STAND_FERIAS', Nombre: 'Stand Ferias' },
    ]);

    await request(app.getHttpServer())
      .get('/api/inventario/ubicaciones')
      .expect(200)
      .expect([
        { code: 'BODEGA_CENTRAL', name: 'Bodega Central' },
        { code: 'POS_FUNA_UNA', name: 'FUNA-UNA' },
        { code: 'POS_EDITORIAL', name: 'Editorial' },
        { code: 'POS_STAND_FERIAS', name: 'Stand Ferias' },
      ]);
  });

  it('rejects location reads with a 403 when the permission is missing', async () => {
    currentRoles = ['Vendedor'];

    await request(app.getHttpServer())
      .get('/api/inventario/ubicaciones')
      .expect(403);

    expect(locationsRepository.find).not.toHaveBeenCalled();
  });

  it('rejects an unknown location code without mutating repositories', async () => {
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

  it.each(['post', 'delete'])(
    'does not expose unsupported location CRUD through %s',
    async (method) => {
      const response =
        method === 'post'
          ? request(app.getHttpServer()).post('/api/inventario/ubicaciones')
          : request(app.getHttpServer()).delete('/api/inventario/ubicaciones');
      await response.expect(404);

      expect(locationsRepository.find).not.toHaveBeenCalled();
      expect(locationsRepository.findOne).not.toHaveBeenCalled();
    },
  );
});
