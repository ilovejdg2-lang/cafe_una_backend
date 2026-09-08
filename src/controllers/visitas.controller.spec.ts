import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';

import { EmailService } from '../common/email.service';
import { PERMISOS_KEY } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { VisitasService } from '../services/visitas.service';
import { VisitasController } from './visitas.controller';

describe('VisitasController', () => {
  let controller: VisitasController;
  let service: {
    crear: jest.Mock;
    obtenerSolicitudes: jest.Mock;
    obtenerSolicitudesDeUsuario: jest.Mock;
    obtenerPorId: jest.Mock;
    actualizar: jest.Mock;
    eliminar: jest.Mock;
  };
  let email: {
    enviarConfirmacionVisitaGrupal: jest.Mock;
    enviarActualizacionEstadoVisitaGrupal: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      crear: jest.fn().mockResolvedValue({
        Id: '202',
        Estado: 'Pendiente',
        EncargadoNombre: 'María Rodríguez',
        EncargadoEmail: 'maria@ejemplo.com',
        FechaVisita: '2026-11-20',
        CantidadVisitantes: 10,
      }),
      obtenerSolicitudes: jest.fn().mockResolvedValue([]),
      obtenerSolicitudesDeUsuario: jest.fn().mockResolvedValue([]),
      obtenerPorId: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn().mockResolvedValue(true),
    };
    email = {
      enviarConfirmacionVisitaGrupal: jest.fn().mockResolvedValue(true),
      enviarActualizacionEstadoVisitaGrupal: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VisitasController],
      providers: [
        { provide: VisitasService, useValue: service },
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    controller = module.get(VisitasController);
  });

  it('protege la creación con autenticación y permiso de visitas', () => {
    // Metadata is attached to the handler function itself by Nest decorators.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = VisitasController.prototype.crearSolicitud;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      JwtAuthGuard,
      PermisosGuard,
    ]);
    expect(Reflect.getMetadata(PERMISOS_KEY, handler)).toEqual([
      'crear_solicitud_visitante',
    ]);
  });

  it('registra una solicitud autenticada y envía confirmación', async () => {
    const resultado = await controller.crearSolicitud(
      {
        EncargadoNombre: 'María Rodríguez',
        EncargadoEmail: 'maria@ejemplo.com',
        EncargadoTelefono: '8888-9999',
        EncargadoIdentificacion: '2-2222-2222',
        TipoVisitante: 'Nacional',
        CiudadProvincia: 'San José',
        CantidadVisitantes: 10,
        TipoGrupo: 'Empresa',
        FechaVisita: '2026-11-20',
        HoraPreferida: 'Tarde',
        MotivoVisita: 'Capacitación',
      },
      { user: { userId: 7, roles: ['Usuario'] } } as never,
    );

    expect(resultado.Id).toBe('202');
    expect(service.crear).toHaveBeenCalledWith(
      expect.objectContaining({ UserId: '7' }),
    );
    expect(email.enviarConfirmacionVisitaGrupal).toHaveBeenCalledWith(
      'maria@ejemplo.com',
      expect.objectContaining({
        nombreEncargado: 'María Rodríguez',
        cantidad: 10,
      }),
    );
  });

  it('impide a un usuario consultar solicitudes ajenas', () => {
    expect(() =>
      controller.obtenerSolicitudesDeUsuario('9', {
        user: { userId: 3, roles: ['Usuario'] },
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('permite a un administrador consultar solicitudes ajenas', async () => {
    await controller.obtenerSolicitudesDeUsuario('9', {
      user: { userId: 3, roles: ['Admin'] },
    } as never);

    expect(service.obtenerSolicitudesDeUsuario).toHaveBeenCalledWith('9');
  });

  it('responde not found cuando se intenta inactivar una solicitud inexistente', async () => {
    service.eliminar.mockResolvedValueOnce(false);

    await expect(controller.eliminarSolicitud('404')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
