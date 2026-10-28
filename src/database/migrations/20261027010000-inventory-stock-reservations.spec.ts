import { QueryRunner } from 'typeorm';
import { InventoryStockReservations20261027010000 } from './20261027010000-inventory-stock-reservations';

describe('InventoryStockReservations20261027010000', () => {
  it('adds a zero-default reservation balance constrained by physical stock and can revert it', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new InventoryStockReservations20261027010000();

    await migration.up({ query } as unknown as QueryRunner);
    const upSql = query.mock.calls.map(([sql]) => String(sql)).join(' ');
    expect(upSql).toMatch(
      /ADD COLUMN "StockReservado" integer NOT NULL DEFAULT 0/i,
    );
    expect(upSql).toMatch(
      /"StockReservado" >= 0 AND "StockReservado" <= "Stock"/i,
    );

    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const downSql = query.mock.calls.map(([sql]) => String(sql)).join(' ');
    expect(downSql).toMatch(/DROP COLUMN IF EXISTS "StockReservado"/i);
  });
});
