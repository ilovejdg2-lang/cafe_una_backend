import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';

import { CamelCaseInterceptor } from '../common/camel-case.interceptor';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { VisitasDisponibilidadService } from '../services/visitas-disponibilidad.service';
import { VisitasDisponibilidadController } from './visitas-disponibilidad.controller';

describe('VisitasDisponibilidadController HTTP contract', () => {
  let app: INestApplication;
  let server: Server;
  let currentUser = { userId: 7, roles: ['Usuario'] };
  const service = {
    listarPublicas: jest.fn(),
    listarAdmin: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    currentUser = { userId: 7, roles: ['Usuario'] };
    service.listarPublicas.mockResolvedValue([
      {
        id: '1',
        fecha: '2099-05-01',
        horaInicio: '08:00:00',
        horaFin: '09:00:00',
        habilitada: true,
        nota: null,
      },
    ]);
    service.listarAdmin.mockResolvedValue([]);
    service.crear.mockResolvedValue({
      id: '2',
      fecha: '2099-05-01',
      horaInicio: '10:00:00',
      horaFin: '11:00:00',
      habilitada: true,
      nota: null,
    });
    service.actualizar.mockResolvedValue({
      id: '2',
      fecha: '2099-05-01',
      horaInicio: '10:00:00',
      horaFin: '11:00:00',
      habilitada: false,
      nota: null,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [VisitasDisponibilidadController],
      providers: [
        PermisosGuard,
        { provide: VisitasDisponibilidadService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: typeof currentUser };
          };
        }) => {
          context.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new CamelCaseInterceptor());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterEach(async () => app.close());

  it('exposes enabled availability publicly with camelCase fields', async () => {
    await request(server)
      .get('/api/visitas/disponibilidad?desde=2099-05-01')
      .expect(200)
      .expect([
        {
          id: '1',
          fecha: '2099-05-01',
          horaInicio: '08:00:00',
          horaFin: '09:00:00',
          habilitada: true,
          nota: null,
        },
      ]);
  });

  it('guards administrative listing and mutations', async () => {
    await request(server).get('/api/visitas/disponibilidad/admin').expect(403);
    await request(server)
      .post('/api/visitas/disponibilidad')
      .send({ fecha: '2099-05-01', horaInicio: '10:00', horaFin: '11:00' })
      .expect(403);

    currentUser = { userId: 1, roles: ['Admin'] };
    await request(server)
      .get('/api/visitas/disponibilidad/admin')
      .expect(200)
      .expect([]);
    await request(server)
      .post('/api/visitas/disponibilidad')
      .send({ fecha: '2099-05-01', horaInicio: '10:00', horaFin: '11:00' })
      .expect(201)
      .expect({
        id: '2',
        fecha: '2099-05-01',
        horaInicio: '10:00:00',
        horaFin: '11:00:00',
        habilitada: true,
        nota: null,
      });
    await request(server)
      .put('/api/visitas/disponibilidad/2')
      .send({ habilitada: false })
      .expect(200)
      .expect({
        id: '2',
        fecha: '2099-05-01',
        horaInicio: '10:00:00',
        horaFin: '11:00:00',
        habilitada: false,
        nota: null,
      });
  });
});
