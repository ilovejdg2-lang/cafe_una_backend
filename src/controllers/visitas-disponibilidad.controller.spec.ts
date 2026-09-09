import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { PERMISOS_KEY } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { VisitasDisponibilidadService } from '../services/visitas-disponibilidad.service';
import { VisitasDisponibilidadController } from './visitas-disponibilidad.controller';

describe('VisitasDisponibilidadController', () => {
  const service = {
    listarPublicas: jest.fn(),
    listarAdmin: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
  };
  let controller: VisitasDisponibilidadController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [VisitasDisponibilidadController],
      providers: [{ provide: VisitasDisponibilidadService, useValue: service }],
    }).compile();
    controller = moduleRef.get(VisitasDisponibilidadController);
  });

  it('keeps the public list unguarded and protects administrative operations', () => {
    /* eslint-disable @typescript-eslint/unbound-method */
    const publicHandler =
      VisitasDisponibilidadController.prototype.listarPublicas;
    const adminHandler = VisitasDisponibilidadController.prototype.listarAdmin;
    const createHandler = VisitasDisponibilidadController.prototype.crear;
    const updateHandler = VisitasDisponibilidadController.prototype.actualizar;
    /* eslint-enable @typescript-eslint/unbound-method */

    expect(Reflect.getMetadata(GUARDS_METADATA, publicHandler)).toBeUndefined();
    for (const handler of [adminHandler, createHandler, updateHandler]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
        JwtAuthGuard,
        PermisosGuard,
      ]);
    }
    expect(Reflect.getMetadata(PERMISOS_KEY, adminHandler)).toEqual([
      'ver_solicitudes_visitantes',
      'administrar_solicitudes_visitantes',
    ]);
    expect(Reflect.getMetadata(PERMISOS_KEY, createHandler)).toEqual([
      'administrar_solicitudes_visitantes',
      'actualizar_visitas',
    ]);
  });

  it('delegates filters and camelCase payloads to the service', async () => {
    await controller.listarPublicas('2099-01-01', '2099-01-31');
    await controller.listarAdmin('2099-02-01', '2099-02-28');
    await controller.crear({
      fecha: '2099-03-01',
      horaInicio: '08:00',
      horaFin: '09:00',
    });
    await controller.actualizar('8', { habilitada: false });

    expect(service.listarPublicas).toHaveBeenCalledWith({
      desde: '2099-01-01',
      hasta: '2099-01-31',
    });
    expect(service.listarAdmin).toHaveBeenCalledWith({
      desde: '2099-02-01',
      hasta: '2099-02-28',
    });
    expect(service.crear).toHaveBeenCalledWith(
      expect.objectContaining({ fecha: '2099-03-01' }),
    );
    expect(service.actualizar).toHaveBeenCalledWith('8', {
      habilitada: false,
    });
  });
});
