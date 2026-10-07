import { QueryRunner } from 'typeorm';
import { InventoryExitReason20261006010000 } from './20261006010000-inventory-exit-reason';

describe('InventoryExitReason20261006010000 movement type constraint', () => {
  it('allows salida_bodega on up and keeps it supported after down without deleting history', async () => {
    const allowsWarehouseExit =
      /ADD CONSTRAINT "CK_movimientos_inventario_tipo"\s+CHECK\s*\(\s*"Tipo"\s+IN\s*\([^)]*'salida_bodega'/i;
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new InventoryExitReason20261006010000();
    const queryRunner = { query } as unknown as QueryRunner;

    await migration.up(queryRunner);

    const upSql = query.mock.calls.map(([sql]) => String(sql)).join(' ');
    expect(upSql).toMatch(
      /DROP CONSTRAINT IF EXISTS "CK_movimientos_inventario_tipo"/i,
    );
    expect(upSql).toMatch(allowsWarehouseExit);

    query.mockClear();
    await migration.down(queryRunner);

    const downSql = query.mock.calls.map(([sql]) => String(sql)).join(' ');
    expect(downSql).toMatch(allowsWarehouseExit);
    expect(downSql).not.toMatch(/DELETE\s+FROM\s+movimientos_inventario/i);
  });
});
