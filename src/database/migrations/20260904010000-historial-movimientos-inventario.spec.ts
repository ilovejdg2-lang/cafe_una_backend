import { QueryRunner } from 'typeorm';

import { HistorialMovimientosInventario20260904010000 } from './20260904010000-historial-movimientos-inventario';

describe('HistorialMovimientosInventario20260904010000', () => {
  it('temporarily disables existing append-only triggers while normalizing rows', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new HistorialMovimientosInventario20260904010000();

    await migration.up({ query } as unknown as QueryRunner);

    const statements = query.mock.calls.map(([sql]) => String(sql));
    const disableIndex = statements.findIndex((sql) =>
      sql.includes('DISABLE TRIGGER USER'),
    );
    const firstUpdateIndex = statements.findIndex((sql) =>
      sql.includes('UPDATE movimientos_inventario'),
    );
    const enableIndex = statements.findIndex((sql) =>
      sql.includes('ENABLE TRIGGER USER'),
    );

    expect(disableIndex).toBeGreaterThan(-1);
    expect(disableIndex).toBeLessThan(firstUpdateIndex);
    expect(enableIndex).toBeGreaterThan(firstUpdateIndex);
  });

  it('re-enables existing triggers when normalization fails', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('UPDATE movimientos_inventario')) {
        return Promise.reject(new Error('normalization failed'));
      }
      return Promise.resolve(undefined);
    });
    const migration = new HistorialMovimientosInventario20260904010000();

    await expect(
      migration.up({ query } as unknown as QueryRunner),
    ).rejects.toThrow('normalization failed');

    expect(
      query.mock.calls.some(([sql]) => String(sql).includes('ENABLE TRIGGER USER')),
    ).toBe(true);
  });
});
