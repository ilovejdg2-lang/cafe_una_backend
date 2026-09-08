import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CamelCaseInterceptor } from '../common/camel-case.interceptor';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { InventarioService } from '../services/inventario.service';
import { TransferenciasController } from './transferencias.controller';

describe('TransferenciasController', () => {
  let app: INestApplication;
  let currentRoles = ['Admin'];
  const inventarioService = {
    transferir: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    currentRoles = ['Admin'];
    inventarioService.transferir.mockResolvedValue({
      id: '88',
      productId: '1',
      cantidad: 3,
      notas: '',
      fecha: '2026-08-26T09:00:00.000Z',
      origen: { codigo: 'BODEGA_CENTRAL', nombre: 'Bodega Central', stock: 7 },
      destino: { codigo: 'POS_EDITORIAL', nombre: 'Editorial', stock: 5 },
      responsableId: 9,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [TransferenciasController],
      providers: [
        PermisosGuard,
        { provide: InventarioService, useValue: inventarioService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: { userId: number; roles: string[] } };
          };
        }) => {
          context.switchToHttp().getRequest().user = {
            userId: 9,
            roles: currentRoles,
          };
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

  it('posts a transfer with camelCase body', async () => {
    await request(app.getHttpServer())
      .post('/api/transferencias')
      .send({
        productoId: '1',
        ubicacionDestinoId: 3,
        cantidad: 3,
        notas: 'Reposición',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.origen.stock).toBe(7);
        expect(body.destino.codigo).toBe('POS_EDITORIAL');
      });

    expect(inventarioService.transferir).toHaveBeenCalledWith(
      expect.objectContaining({
        productoId: '1',
        cantidad: 3,
      }),
      9,
    );
  });

  it('rejects transfers without permission', async () => {
    currentRoles = ['Cliente'];
    await request(app.getHttpServer())
      .post('/api/transferencias')
      .send({ productoId: '1', ubicacionDestinoId: 3, cantidad: 1 })
      .expect(403);
    expect(inventarioService.transferir).not.toHaveBeenCalled();
  });
});
