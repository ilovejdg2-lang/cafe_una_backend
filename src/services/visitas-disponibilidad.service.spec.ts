import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';

import { DisponibilidadVisita } from '../entities/disponibilidad-visita.entity';
import { VisitasDisponibilidadService } from './visitas-disponibilidad.service';

describe('VisitasDisponibilidadService', () => {
  let service: VisitasDisponibilidadService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn(
        (value: Partial<DisponibilidadVisita>) => value as DisponibilidadVisita,
      ),
      save: jest.fn((value: Partial<DisponibilidadVisita>) =>
        Promise.resolve({ Id: '4', ...value } as DisponibilidadVisita),
      ),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        VisitasDisponibilidadService,
        {
          provide: getRepositoryToken(DisponibilidadVisita),
          useValue: repo,
        },
      ],
    }).compile();
    service = moduleRef.get(VisitasDisponibilidadService);
  });

  it('lists enabled non-past slots publicly in date/start order', async () => {
    const andWhere = jest.fn();
    const orderBy = jest.fn();
    const addOrderBy = jest.fn();
    const qb = {
      andWhere,
      orderBy,
      addOrderBy,
      getMany: jest.fn().mockResolvedValue([
        {
          Id: '4',
          Fecha: '2099-01-20',
          HoraInicio: '09:00:00',
          HoraFin: '10:00:00',
          Habilitada: true,
          Nota: null,
        },
      ]),
    } as unknown as SelectQueryBuilder<DisponibilidadVisita>;
    andWhere.mockReturnValue(qb);
    orderBy.mockReturnValue(qb);
    addOrderBy.mockReturnValue(qb);
    repo.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.listarPublicas({ desde: '2099-01-01', hasta: '2099-01-31' }),
    ).resolves.toEqual([
      {
        id: '4',
        fecha: '2099-01-20',
        horaInicio: '09:00:00',
        horaFin: '10:00:00',
        habilitada: true,
        nota: null,
      },
    ]);
    expect(andWhere).toHaveBeenCalledWith('d.Habilitada = true');
    expect(orderBy).toHaveBeenCalledWith('d.Fecha', 'ASC');
    expect(addOrderBy).toHaveBeenCalledWith('d.HoraInicio', 'ASC');
  });

  it('lists all slots for administrators', async () => {
    const andWhere = jest.fn();
    const orderBy = jest.fn();
    const addOrderBy = jest.fn();
    const qb = {
      andWhere,
      orderBy,
      addOrderBy,
      getMany: jest.fn().mockResolvedValue([]),
    } as unknown as SelectQueryBuilder<DisponibilidadVisita>;
    andWhere.mockReturnValue(qb);
    orderBy.mockReturnValue(qb);
    addOrderBy.mockReturnValue(qb);
    repo.createQueryBuilder.mockReturnValue(qb);

    await service.listarAdmin({ desde: '2099-02-01', hasta: '2099-02-28' });

    expect(andWhere).not.toHaveBeenCalledWith('d.Habilitada = true');
    expect(orderBy).toHaveBeenCalledWith('d.Fecha', 'ASC');
  });

  it('creates non-overlapping slots on the same date', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(
      service.crear({
        fecha: '2099-02-10',
        horaInicio: '10:00',
        horaFin: '11:00',
        nota: 'Grupo escolar',
      }),
    ).resolves.toMatchObject({
      id: '4',
      fecha: '2099-02-10',
      horaInicio: '10:00:00',
      horaFin: '11:00:00',
      habilitada: true,
    });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ fecha: '2020-01-01', horaInicio: '10:00', horaFin: '11:00' }, 'pasado'],
    [
      { fecha: '2099-01-01', horaInicio: '11:00', horaFin: '10:00' },
      'posterior',
    ],
  ])('rejects invalid slot boundaries', async (body, message) => {
    await expect(service.crear(body)).rejects.toThrow(message);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each([
    ['duplicado', { Id: '1' }, null],
    ['traslapa', null, { Id: '2' }],
  ])('rejects a %s slot', async (_case, duplicate, overlap) => {
    repo.findOne
      .mockResolvedValueOnce(duplicate)
      .mockResolvedValueOnce(overlap);

    await expect(
      service.crear({
        fecha: '2099-03-10',
        horaInicio: '10:00',
        horaFin: '11:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('edits and enables or disables an existing slot', async () => {
    repo.findOne
      .mockResolvedValueOnce({
        Id: '7',
        Fecha: '2099-04-01',
        HoraInicio: '08:00:00',
        HoraFin: '09:00:00',
        Habilitada: true,
        Nota: null,
      })
      .mockResolvedValue(null);

    await expect(
      service.actualizar('7', { habilitada: false, nota: 'Cerrado' }),
    ).resolves.toMatchObject({ id: '7', habilitada: false, nota: 'Cerrado' });
  });

  it('rejects edits for a missing slot', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(
      service.actualizar('404', { habilitada: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
