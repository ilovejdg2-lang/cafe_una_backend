import { Test, TestingModule } from '@nestjs/testing';

import { EmailService } from '../common/email.service';
import { VisitasController } from './visitas.controller';
import { VisitasService } from '../services/visitas.service';

describe('VisitasController', () => {
  let controller: VisitasController;
  let serviceMock: any;
  let emailMock: any;

  beforeEach(async () => {
    serviceMock = {
      crear: jest.fn((dto) => Promise.resolve({ Id: '202', Estado: 'Pendiente', ...dto })),
      obtenerSolicitudes: jest.fn(() => Promise.resolve([])),
      obtenerPorId: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(() => Promise.resolve(true)),
    };

    emailMock = {
      enviarConfirmacionVisitaGrupal: jest.fn(() => Promise.resolve(true)),
      enviarActualizacionEstadoVisitaGrupal: jest.fn(() => Promise.resolve(true)),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VisitasController],
      providers: [
        { provide: VisitasService, useValue: serviceMock },
        { provide: EmailService, useValue: emailMock },
      ],
    }).compile();

    controller = module.get<VisitasController>(VisitasController);
  });

  it('debe registrar una solicitud y enviar correo de confirmación', async () => {
    const res = await controller.crearSolicitud({
      EncargadoNombre: 'María Rodríguez',
      EncargadoEmail: 'maria@ejemplo.com',
      EncargadoTelefono: '8888-9999',
      EncargadoIdentificacion: '2-2222-2222',
      TipoVisitante: 'Nacional',
      CiudadProvincia: 'San José',
      CantidadVisitantes: 10,
      TipoGrupo: 'Empresa',
      FechaVisita: '2026-11-20',
      HoraPreferida: 'Tarde (1:00 p. m. – 4:30 p. m.)',
      MotivoVisita: 'Capacitación',
    }, {} as any);

    expect(res.Id).toBe('202');
    expect(serviceMock.crear).toHaveBeenCalled();
    expect(emailMock.enviarConfirmacionVisitaGrupal).toHaveBeenCalledWith(
      'maria@ejemplo.com',
      expect.objectContaining({
        nombreEncargado: 'María Rodríguez',
        cantidad: 10,
      }),
    );
  });
});
