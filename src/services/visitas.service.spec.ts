import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';

import { DisponibilidadVisita } from '../entities/disponibilidad-visita.entity';
import { VisitaGrupal } from '../entities/visita-grupal.entity';
import { VisitasService } from './visitas.service';

describe('VisitasService', () => {
  let service: VisitasService;
  let createMock: jest.Mock;
  let saveMock: jest.Mock;
  let findOneMock: jest.Mock;
  let findAvailabilityMock: jest.Mock;
  let createQueryBuilderMock: jest.Mock;

  beforeEach(async () => {
    createMock = jest.fn((datos: Partial<VisitaGrupal>) => datos);
    saveMock = jest.fn((entidad: Partial<VisitaGrupal>) =>
      Promise.resolve({ Id: '101', ...entidad }),
    );
    findOneMock = jest.fn();
    findAvailabilityMock = jest.fn().mockResolvedValue({
      Id: '9',
      Fecha: '2099-10-15',
      HoraInicio: '08:00:00',
      HoraFin: '09:30:00',
      Habilitada: true,
    });
    createQueryBuilderMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitasService,
        {
          provide: getRepositoryToken(VisitaGrupal),
          useValue: {
            create: createMock,
            save: saveMock,
            findOne: findOneMock,
            find: jest.fn(),
            createQueryBuilder: createQueryBuilderMock,
          },
        },
        {
          provide: getRepositoryToken(DisponibilidadVisita),
          useValue: { findOne: findAvailabilityMock },
        },
      ],
    }).compile();

    service = module.get(VisitasService);
  });

  it('crea una solicitud grupal válida como pendiente', async () => {
    const resultado = await service.crear({
      EncargadoNombre: 'Carlos Méndez',
      EncargadoEmail: 'carlos@ejemplo.com',
      EncargadoTelefono: '8888-8888',
      EncargadoIdentificacion: '1-1111-1111',
      TipoVisitante: 'Nacional',
      CiudadProvincia: 'Heredia',
      CantidadVisitantes: 5,
      TipoGrupo: 'Universidad',
      DisponibilidadVisitaId: '9',
      FechaVisita: '2000-01-01',
      HoraPreferida: 'valor del cliente',
      MotivoVisita: 'Gira académica',
    });

    expect(resultado).toMatchObject({ Id: '101', Estado: 'Pendiente' });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        CantidadVisitantes: 5,
        Estado: 'Pendiente',
        TipoVisitante: 'Nacional',
        DisponibilidadVisitaId: '9',
        FechaVisita: '2099-10-15',
        HoraPreferida: '08:00:00 - 09:30:00',
      }),
    );
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sin selección', undefined, undefined, 'seleccionar'],
    ['inexistente', '404', null, 'no existe'],
    [
      'deshabilitada',
      '9',
      { Id: '9', Fecha: '2099-10-15', Habilitada: false },
      'habilitado',
    ],
    [
      'pasada',
      '9',
      { Id: '9', Fecha: '2020-01-01', Habilitada: true },
      'pasado',
    ],
  ])(
    'rechaza una disponibilidad %s sin guardar la solicitud',
    async (_caso, id, disponibilidad, mensaje) => {
      findAvailabilityMock.mockResolvedValueOnce(disponibilidad);

      await expect(
        service.crear({
          EncargadoNombre: 'Persona Encargada',
          EncargadoEmail: 'persona@ejemplo.com',
          EncargadoTelefono: '8888-8888',
          CantidadVisitantes: 3,
          TipoVisitante: 'Nacional',
          DisponibilidadVisitaId: id,
        }),
      ).rejects.toThrow(mensaje);
      expect(saveMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ CantidadVisitantes: 1 }, 'mínimo 2 personas'],
    [
      {
        CantidadVisitantes: 3,
        TipoVisitante: 'Internacional',
        PaisProcedencia: '',
      },
      'país de procedencia',
    ],
  ])('rechaza reglas de negocio inválidas', async (datos, mensaje) => {
    await expect(
      service.crear({
        EncargadoNombre: 'Persona Encargada',
        EncargadoEmail: 'persona@ejemplo.com',
        EncargadoTelefono: '8888-8888',
        FechaVisita: '2026-10-15',
        HoraPreferida: 'Mañana',
        ...datos,
      }),
    ).rejects.toThrow(mensaje);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('aplica filtros y orden descendente al listado administrativo', async () => {
    const andWhere = jest.fn();
    const orderBy = jest.fn();
    const qb = {
      andWhere,
      orderBy,
      getMany: jest.fn().mockResolvedValue([]),
    } as unknown as SelectQueryBuilder<VisitaGrupal>;
    andWhere.mockReturnValue(qb);
    orderBy.mockReturnValue(qb);
    createQueryBuilderMock.mockReturnValue(qb);

    await service.obtenerSolicitudes({
      estado: 'Pendiente',
      tipoVisitante: 'Internacional',
      fechaDesde: '2026-10-01',
      fechaHasta: '2026-10-31',
      busqueda: 'Carlos',
    });

    expect(andWhere).toHaveBeenCalledTimes(5);
    expect(orderBy).toHaveBeenCalledWith('v.Id', 'DESC');
  });

  it('inactiva una solicitud existente y rechaza actualizar una inexistente', async () => {
    const existente = { Id: '7', Estado: 'Pendiente' } as VisitaGrupal;
    findOneMock.mockResolvedValueOnce(existente).mockResolvedValueOnce(null);

    await expect(service.eliminar('7')).resolves.toBe(true);
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ Estado: 'Inactiva' }),
    );
    await expect(service.actualizar('8', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
