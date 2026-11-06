import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FindOperator, QueryFailedError } from 'typeorm';
import { CierresCompraService } from './cierres-compra.service';

type Fila = {
  Id: number;
  Fecha: string;
  Nota: string;
  UbicacionId: number | null;
};

type Where = {
  Fecha: FindOperator<string> | string;
  UbicacionId: unknown;
};

describe('CierresCompraService', () => {
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((datos: Partial<Fila>) => ({ ...datos })),
    save: jest.fn((fila: Partial<Fila>) => Promise.resolve({ Id: 1, ...fila })),
    remove: jest.fn(),
  };
  const ubicaciones = { findOne: jest.fn() };
  let service: CierresCompraService;

  const dbError = (code: string) =>
    new QueryFailedError('SQL', [], Object.assign(new Error('db'), { code }));
  const fila = (
    Id: number,
    Fecha: string,
    UbicacionId: number | null,
    Nota = '',
  ): Fila => ({ Id, Fecha, Nota, UbicacionId });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-06T18:00:00Z'));
    repo.find.mockResolvedValue([]);
    repo.findOne.mockResolvedValue(null);
    ubicaciones.findOne.mockResolvedValue({ Id: 4, Activo: true });
    service = new CierresCompraService(repo as never, ubicaciones as never);
  });

  afterEach(() => jest.useRealTimers());

  describe('crear', () => {
    it('creates a global closure with a trimmed note', async () => {
      const out = await service.crear({
        fecha: '2026-12-25',
        nota: '  Navidad  ',
        ubicacionId: null,
      });

      expect(repo.create).toHaveBeenCalledWith({
        Fecha: '2026-12-25',
        Nota: 'Navidad',
        UbicacionId: null,
      });
      expect(ubicaciones.findOne).not.toHaveBeenCalled();
      expect(out).toEqual({
        Id: 1,
        Fecha: '2026-12-25',
        Nota: 'Navidad',
        UbicacionId: null,
      });
    });

    it('accepts PascalCase keys and computes today in Costa Rica time', async () => {
      // 03:00Z on the 7th is still the 6th in Costa Rica (UTC-6).
      jest.setSystemTime(new Date('2026-11-07T03:00:00Z'));
      await expect(
        service.crear({ Fecha: '2026-11-06', Nota: '', UbicacionId: undefined }),
      ).resolves.toMatchObject({ Fecha: '2026-11-06', UbicacionId: null });
    });

    it('creates a closure for an active point of sale', async () => {
      await service.crear({ fecha: '2026-12-25', ubicacionId: 4 });
      expect(ubicaciones.findOne).toHaveBeenCalledWith({
        where: { Id: 4, Activo: true },
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ UbicacionId: 4, Nota: '' }),
      );
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['wrong format', '25/12/2026'],
      ['with time', '2026-12-25T00:00:00'],
      ['not a real date', '2026-02-30'],
      ['month 13', '2026-13-01'],
      ['not a string', 20261225],
    ])('rejects a malformed date (%s)', async (_label, fecha) => {
      await expect(service.crear({ fecha })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects past dates', async () => {
      await expect(service.crear({ fecha: '2026-11-05' })).rejects.toThrow(
        'La fecha ya pasó.',
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects an overlong or non-string note', async () => {
      await expect(
        service.crear({ fecha: '2026-12-25', nota: 'x'.repeat(301) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.crear({ fecha: '2026-12-25', nota: { a: 1 } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([0, -1, 1.5, 'abc', true])(
      'rejects an invalid ubicacionId (%p)',
      async (ubicacionId) => {
        await expect(
          service.crear({ fecha: '2026-12-25', ubicacionId }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('rejects an unknown or inactive point of sale', async () => {
      ubicaciones.findOne.mockResolvedValue(null);
      await expect(
        service.crear({ fecha: '2026-12-25', ubicacionId: 99 }),
      ).rejects.toThrow('El punto de venta no existe o está inactivo.');
    });

    it('rejects a duplicate (fecha, punto) with 409', async () => {
      repo.findOne.mockResolvedValue({ Id: 7 });
      await expect(
        service.crear({ fecha: '2026-12-25', ubicacionId: null }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
      const { where } = repo.findOne.mock.calls[0][0] as { where: Where };
      expect(where.Fecha).toBe('2026-12-25');
      expect(where.UbicacionId).toBeInstanceOf(FindOperator);
    });

    it('maps a unique-index violation from a concurrent insert to 409', async () => {
      repo.save.mockRejectedValueOnce(dbError('23505'));
      await expect(
        service.crear({ fecha: '2026-12-25' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not swallow other database errors', async () => {
      const boom = dbError('08006');
      repo.save.mockRejectedValueOnce(boom);
      await expect(service.crear({ fecha: '2026-12-25' })).rejects.toBe(boom);
    });

    it('scopes the duplicate lookup to the same point so global and point closures coexist', async () => {
      await service.crear({ fecha: '2026-12-25', ubicacionId: 4 });
      const { where } = repo.findOne.mock.calls[0][0] as { where: Where };
      expect(where.UbicacionId).toBe(4);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('removes an existing closure', async () => {
      const existente = { Id: 3 };
      repo.findOne.mockResolvedValue(existente);
      await service.eliminar(3);
      expect(repo.remove).toHaveBeenCalledWith(existente);
    });

    it('returns 404 for a missing id', async () => {
      await expect(service.eliminar(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  describe('listarPublicos', () => {
    it('only asks for today or later, global rows only without ubicacionId', async () => {
      await service.listarPublicos(null);
      const { where, order } = repo.find.mock.calls[0][0] as {
        where: Where[];
        order: Record<string, string>;
      };
      const fecha = where[0].Fecha as FindOperator<string>;
      expect(where).toHaveLength(1);
      expect(fecha.type).toBe('moreThanOrEqual');
      expect(fecha.value).toBe('2026-11-06');
      expect(where[0].UbicacionId).toBeInstanceOf(FindOperator);
      expect(order).toEqual({ Fecha: 'ASC', Id: 'ASC' });
    });

    it('asks for global plus the requested point of sale', async () => {
      await service.listarPublicos(4);
      const { where } = repo.find.mock.calls[0][0] as { where: Where[] };
      expect(where).toHaveLength(2);
      expect(where[1].UbicacionId).toBe(4);
      expect((where[1].Fecha as FindOperator<string>).value).toBe('2026-11-06');
    });

    it('exposes only id, fecha, nota and ubicacionId', async () => {
      repo.find.mockResolvedValue([
        { ...fila(1, '2026-12-25', null, 'Navidad'), CreadoEn: new Date() },
      ]);
      await expect(service.listarPublicos(null)).resolves.toEqual([
        { Id: 1, Fecha: '2026-12-25', Nota: 'Navidad', UbicacionId: null },
      ]);
    });

    it('keeps the point-specific row when a global one shares the date', async () => {
      repo.find.mockResolvedValue([
        fila(1, '2026-12-25', null, 'General'),
        fila(2, '2026-12-25', 4, 'Solo este punto'),
        fila(3, '2026-12-26', null, 'Otro'),
      ]);
      const out = await service.listarPublicos(4);
      expect(out.map((r) => r.Id)).toEqual([2, 3]);
    });

    it('degrades to an empty list when the table does not exist yet', async () => {
      repo.find.mockRejectedValue(dbError('42P01'));
      await expect(service.listarPublicos(null)).resolves.toEqual([]);
    });

    it('does not hide other database errors', async () => {
      repo.find.mockRejectedValue(dbError('08006'));
      await expect(service.listarPublicos(null)).rejects.toBeInstanceOf(
        QueryFailedError,
      );
    });
  });

  describe('listarAdmin', () => {
    it('lists every closure ordered by fecha, past ones included', async () => {
      repo.find.mockResolvedValue([
        fila(2, '2026-01-01', null, 'a'),
        fila(1, '2026-12-25', 4, 'b'),
      ]);
      const out = await service.listarAdmin();
      expect(repo.find).toHaveBeenCalledWith({
        order: { Fecha: 'ASC', Id: 'ASC' },
      });
      expect(out.map((r) => r.Id)).toEqual([2, 1]);
    });

    it('does not degrade silently: admin errors surface', async () => {
      repo.find.mockRejectedValue(dbError('42P01'));
      await expect(service.listarAdmin()).rejects.toBeInstanceOf(
        QueryFailedError,
      );
    });
  });
});
