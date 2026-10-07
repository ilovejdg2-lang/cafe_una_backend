import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AsignacionesPuntoVentaService } from '../services/asignaciones-punto-venta.service';
import { InventarioService } from '../services/inventario.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { InventarioController } from './inventario.controller';

describe('inventory exit HTTP routes', () => {
  let app: INestApplication;
  let role = 'Admin';
  const body = {
    productoId: '101',
    cantidad: 2,
    motivoSalidaId: 3,
    destinatario: 'Biblioteca de la comunidad',
  };
  const inventory = {
    listarMotivosSalida: jest.fn().mockResolvedValue([
      { id: 1, nombre: 'Venta' },
      { id: 2, nombre: 'Donación' },
      { id: 3, nombre: 'Traslado' },
      { id: 4, nombre: 'Ajuste por merma' },
    ]),
    registrarSalida: jest.fn().mockResolvedValue({
      id: '7001',
      productoId: '101',
      cantidad: 2,
      motivoSalidaId: 3,
      destinatario: 'Biblioteca de la comunidad',
      stockRestante: 6,
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InventarioController],
      providers: [
        { provide: InventarioService, useValue: inventory },
        { provide: AsignacionesPuntoVentaService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          context.switchToHttp().getRequest().user = { userId: 44, roles: [role] };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    role = 'Admin';
    jest.clearAllMocks();
  });

  it('returns the ordered exit reason catalog to authorized users', async () => {
    await request(app.getHttpServer())
      .get('/api/inventario/motivos-salida')
      .expect(200)
      .expect([
        { id: 1, nombre: 'Venta' },
        { id: 2, nombre: 'Donación' },
        { id: 3, nombre: 'Traslado' },
        { id: 4, nombre: 'Ajuste por merma' },
      ]);

    expect(inventory.listarMotivosSalida).toHaveBeenCalledTimes(1);
  });

  it('denies users without inventory-adjustment permission on catalog and write routes', async () => {
    role = 'Cliente';

    await request(app.getHttpServer())
      .get('/api/inventario/motivos-salida')
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/inventario/salidas')
      .send(body)
      .expect(403);

    expect(inventory.listarMotivosSalida).not.toHaveBeenCalled();
    expect(inventory.registrarSalida).not.toHaveBeenCalled();
  });

  it('forwards the authenticated actor and exit data to the transactional service', async () => {
    await request(app.getHttpServer())
      .post('/api/inventario/salidas')
      .send(body)
      .expect(201)
      .expect({
        id: '7001',
        productoId: '101',
        cantidad: 2,
        motivoSalidaId: 3,
        destinatario: 'Biblioteca de la comunidad',
        stockRestante: 6,
      });

    expect(inventory.registrarSalida).toHaveBeenCalledWith(body, 44);
  });
});
