import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';

import { VisitaGrupal } from '../entities/visita-grupal.entity';
import { VisitasService } from './visitas.service';

describe('VisitasService', () => {
  let service: VisitasService;
  let createMock: jest.Mock;
  let saveMock: jest.Mock;
  let findOneMock: jest.Mock;
  let createQueryBuilderMock: jest.Mock;

  beforeEach(async () => {
    createMock = jest.fn((datos: Partial<VisitaGrupal>) => datos);
    saveMock = jest.fn((entidad: Partial<VisitaGrupal>) =>
      Promise.resolve({ Id: '101', ...entidad }),
    );
    findOneMock = jest.fn();
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
      FechaVisita: '2026-10-15',
      HoraPreferida: 'Mañana',
      MotivoVisita: 'Gira académica',
    });

    expect(resultado).toMatchObject({ Id: '101', Estado: 'Pendiente' });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        CantidadVisitantes: 5,
        Estado: 'Pendiente',
        TipoVisitante: 'Nacional',
      }),
    );
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

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
