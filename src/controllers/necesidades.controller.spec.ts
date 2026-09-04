import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CamelCaseInterceptor } from '../common/camel-case.interceptor';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { NecesidadesService } from '../services/necesidades.service';
import { NecesidadesController } from './necesidades.controller';

describe('NecesidadesController', () => {
  let app: INestApplication;
  let currentRoles: string[] | null = ['Admin'];
  const necesidadesService = {
    listarPublicas: jest.fn(),
    listarAdmin: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    inactivar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    currentRoles = ['Admin'];
    necesidadesService.listarPublicas.mockResolvedValue([
      { id: 1, titulo: 'Herramientas agrícolas', prioridad: 'ALTA', estado: 'ACTIVA' },
    ]);
    necesidadesService.listarAdmin.mockResolvedValue([]);
    necesidadesService.crear.mockResolvedValue({ id: 2, prioridad: 'MEDIA' });
    necesidadesService.inactivar.mockResolvedValue({ id: 1, estado: 'INACTIVA' });

    const moduleRef = await Test.createTestingModule({
      controllers: [NecesidadesController],
      providers: [
        PermisosGuard,
        { provide: NecesidadesService, useValue: necesidadesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: { userId: number; roles: string[] } };
          };
        }) => {
          if (currentRoles === null) return false;
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

  it('lists active needs without authentication', async () => {
    currentRoles = null;
    await request(app.getHttpServer())
      .get('/api/v1/donaciones/necesidades')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0].titulo).toBe('Herramientas agrícolas');
      });
    expect(necesidadesService.listarPublicas).toHaveBeenCalled();
  });

  it('rejects admin create without token', async () => {
    currentRoles = null;
    await request(app.getHttpServer())
      .post('/api/v1/donaciones/necesidades')
      .send({ titulo: 'X', descripcion: 'Y', prioridad: 'ALTA' })
      .expect(403);
    expect(necesidadesService.crear).not.toHaveBeenCalled();
  });

  it('rejects admin create for Cliente', async () => {
    currentRoles = ['Cliente'];
    await request(app.getHttpServer())
      .post('/api/v1/donaciones/necesidades')
      .send({ titulo: 'X', descripcion: 'Y', prioridad: 'ALTA' })
      .expect(403);
  });
});
