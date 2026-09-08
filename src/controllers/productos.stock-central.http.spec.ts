import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CamelCaseInterceptor } from '../common/camel-case.interceptor';
import { PascalBodyInterceptor } from '../common/pascal-body.interceptor';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { InventarioService } from '../services/inventario.service';
import { ProductosService } from '../services/productos.service';
import { ProductosController } from './productos.controller';

describe('ProductosController central stock HTTP contract', () => {
  let app: INestApplication;
  let currentRoles = ['Admin'];
  const service = { actualizarStockCentral: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    currentRoles = ['Admin'];
    service.actualizarStockCentral.mockResolvedValue({
      productId: '1',
      locationCode: 'BODEGA_CENTRAL',
      stock: 7,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [ProductosController],
      providers: [
        PermisosGuard,
        { provide: ProductosService, useValue: {} },
        { provide: InventarioService, useValue: service },
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
    app.useGlobalInterceptors(
      new PascalBodyInterceptor(),
      new CamelCaseInterceptor(),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects a write without actualizar_stock_productos with HTTP 403', async () => {
    currentRoles = ['Cliente'];

    await request(app.getHttpServer())
      .put('/api/productos/1/stock-central')
      .send({ stock: 7 })
      .expect(403);

    expect(service.actualizarStockCentral).not.toHaveBeenCalled();
  });

  it.each([{ stock: 7 }, { Stock: 7 }])(
    'accepts the central stock body contract: %j',
    async (body) => {
      await request(app.getHttpServer())
        .put('/api/productos/1/stock-central')
        .send(body)
        .expect(200)
        .expect({
          productId: '1',
          locationCode: 'BODEGA_CENTRAL',
          stock: 7,
        });
    },
  );

  it('rejects a point-of-sale location without invoking the write service', async () => {
    await request(app.getHttpServer())
      .put('/api/productos/1/stock-central')
      .send({ stock: 7, locationCode: 'POS_FUNA_UNA' })
      .expect(400);

    expect(service.actualizarStockCentral).not.toHaveBeenCalled();
  });
});
