import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';

import { CamelCaseInterceptor } from '../common/camel-case.interceptor';
import { EmailService } from '../common/email.service';
import { PascalBodyInterceptor } from '../common/pascal-body.interceptor';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { VisitasService } from '../services/visitas.service';
import { VisitasController } from './visitas.controller';

describe('VisitasController HTTP contract', () => {
  let app: INestApplication;
  let server: Server;
  let currentUser = { userId: 7, roles: ['Usuario'] };
  const visitasService = {
    crear: jest.fn(),
    obtenerSolicitudes: jest.fn(),
    obtenerSolicitudesDeUsuario: jest.fn(),
    obtenerPorId: jest.fn(),
    actualizar: jest.fn(),
    eliminar: jest.fn(),
  };
  const emailService = {
    enviarConfirmacionVisitaGrupal: jest.fn(),
    enviarActualizacionEstadoVisitaGrupal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    currentUser = { userId: 7, roles: ['Usuario'] };
    visitasService.crear.mockResolvedValue({
      Id: '15',
      UserId: '7',
      Estado: 'Pendiente',
      EncargadoNombre: 'Ana López',
      EncargadoEmail: 'ana@ejemplo.com',
      FechaVisita: '2026-12-01',
      CantidadVisitantes: 4,
    });
    visitasService.obtenerSolicitudes.mockResolvedValue([]);
    emailService.enviarConfirmacionVisitaGrupal.mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      controllers: [VisitasController],
      providers: [
        PermisosGuard,
        { provide: VisitasService, useValue: visitasService },
        { provide: EmailService, useValue: emailService },
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
    app.useGlobalInterceptors(
      new PascalBodyInterceptor(),
      new CamelCaseInterceptor(),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  it('acepta el payload del frontend y responde en camelCase', async () => {
    await request(server)
      .post('/api/visitas/solicitudes')
      .send({
        EncargadoNombre: 'Ana López',
        EncargadoIdentificacion: '123456789',
        EncargadoEmail: 'ana@ejemplo.com',
        EncargadoTelefono: '8888-7777',
        TipoVisitante: 'Internacional',
        PaisProcedencia: 'España',
        CiudadProvincia: 'Madrid',
        CantidadVisitantes: 4,
        TipoGrupo: 'Universidad',
        FechaVisita: '2026-12-01',
        HoraPreferida: 'Mañana',
        MotivoVisita: 'Investigación',
      })
      .expect(201)
      .expect({
        id: '15',
        userId: '7',
        estado: 'Pendiente',
        encargadoNombre: 'Ana López',
        encargadoEmail: 'ana@ejemplo.com',
        fechaVisita: '2026-12-01',
        cantidadVisitantes: 4,
      });

    expect(visitasService.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        UserId: '7',
        EncargadoNombre: 'Ana López',
        CantidadVisitantes: 4,
      }),
    );
  });

  it('protege el listado administrativo', async () => {
    await request(server).get('/api/visitas/solicitudes').expect(403);

    currentUser = { userId: 1, roles: ['Admin'] };
    await request(server)
      .get('/api/visitas/solicitudes')
      .expect(200)
      .expect([]);
  });
});
