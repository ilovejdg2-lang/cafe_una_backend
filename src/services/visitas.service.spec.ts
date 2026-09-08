import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { VisitaGrupal } from '../entities/visita-grupal.entity';
import { VisitasService } from './visitas.service';

describe('VisitasService', () => {
  let service: VisitasService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entidad) => Promise.resolve({ Id: '101', ...entidad })),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitasService,
        {
          provide: getRepositoryToken(VisitaGrupal),
          useValue: repoMock,
        },
      ],
    }).compile();

    service = module.get<VisitasService>(VisitasService);
  });

  it('debe crear una solicitud de visita válida', async () => {
    const res = await service.crear({
      EncargadoNombre: 'Carlos Méndez',
      EncargadoEmail: 'carlos@ejemplo.com',
      EncargadoTelefono: '8888-8888',
      EncargadoIdentificacion: '1-1111-1111',
      TipoVisitante: 'Nacional',
      CiudadProvincia: 'Heredia',
      CantidadVisitantes: 5,
      TipoGrupo: 'Universidad',
      FechaVisita: '2026-10-15',
      HoraPreferida: 'Mañana (8:00 a. m. – 11:30 a. m.)',
      MotivoVisita: 'Gira académica',
    });

    expect(res.Id).toBe('101');
    expect(res.Estado).toBe('Pendiente');
    expect(repoMock.save).toHaveBeenCalled();
  });

  it('debe rechazar solicitudes con menos de 2 participantes', async () => {
    await expect(
      service.crear({
        EncargadoNombre: 'Solo Persona',
        EncargadoEmail: 'solo@ejemplo.com',
        EncargadoTelefono: '8888-8888',
        CantidadVisitantes: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe requerir País de procedencia si el tipo de visitante es Internacional', async () => {
    await expect(
      service.crear({
        EncargadoNombre: 'Jane Doe',
        EncargadoEmail: 'jane@example.com',
        EncargadoTelefono: '12345678',
        TipoVisitante: 'Internacional',
        PaisProcedencia: '',
        CantidadVisitantes: 3,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
