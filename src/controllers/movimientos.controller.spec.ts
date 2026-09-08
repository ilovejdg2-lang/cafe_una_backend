import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CamelCaseInterceptor } from '../common/camel-case.interceptor';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { MovimientosService } from '../services/movimientos.service';
import { MovimientosController } from './movimientos.controller';

describe('MovimientosController', () => {
  let app: INestApplication;
  let currentRoles = ['Admin'];
  const movimientosService = {
    listar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    currentRoles = ['Admin'];
    movimientosService.listar.mockResolvedValue({
      items: [
        {
          id: '1',
          fecha: '2026-09-03T18:00:00.000Z',
          tipo: 'entrada',
          productoId: '4',
          productoNombre: 'Café molido',
          cantidad: 10,
          ubicacionOrigenId: null,
          origenNombre: '',
          ubicacionDestinoId: 1,
          destinoNombre: 'Bodega Central',
          responsableId: 9,
          responsableNombre: 'Fatima',
          notas: '',
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [MovimientosController],
      providers: [
        PermisosGuard,
        { provide: MovimientosService, useValue: movimientosService },
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

  it('lists movements with combinable filters and total', async () => {
    await request(app.getHttpServer())
      .get('/api/movimientos')
      .query({
        producto_id: '4',
        tipo: 'entrada',
        ubicacion_id: '1',
        fecha_desde: '2026-09-01',
        fecha_hasta: '2026-09-03',
        page: '1',
        limit: '25',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.total).toBe(1);
        expect(body.items[0].productoNombre).toBe('Café molido');
        expect(body.items[0].destinoNombre).toBe('Bodega Central');
      });

    expect(movimientosService.listar).toHaveBeenCalledWith(
      expect.objectContaining({
        producto_id: '4',
        tipo: 'entrada',
        ubicacion_id: '1',
        fecha_desde: '2026-09-01',
        fecha_hasta: '2026-09-03',
        page: '1',
        limit: '25',
      }),
    );
  });

  it('rejects clients without ver_inventario', async () => {
    currentRoles = ['Cliente'];
    await request(app.getHttpServer()).get('/api/movimientos').expect(403);
    expect(movimientosService.listar).not.toHaveBeenCalled();
  });
});
