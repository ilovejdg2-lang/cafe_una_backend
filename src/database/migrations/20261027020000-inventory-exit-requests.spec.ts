import { QueryRunner } from 'typeorm';
import { InventoryExitRequests20261027020000 } from './20261027020000-inventory-exit-requests';

describe('InventoryExitRequests20261027020000', () => {
  it('creates auditable multi-item requests and uniquely links movements', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new InventoryExitRequests20261027020000();

    await migration.up({ query } as unknown as QueryRunner);

    const upSql = query.mock.calls.map(([sql]) => String(sql)).join(' ');
    expect(upSql).toMatch(/INSERT INTO motivos_salida.*Regalía/s);
    expect(upSql).toMatch(/CREATE TABLE solicitudes_salida_inventario_items/s);
    expect(upSql).toMatch(
      /CREATE TABLE auditoria_solicitud_salida_inventario/s,
    );
    expect(upSql).toMatch(/ADD COLUMN "SolicitudSalidaId" bigint NULL/s);
    expect(upSql).toMatch(
      /CREATE UNIQUE INDEX "UQ_movimiento_salida_solicitud_producto"/s,
    );

    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const downSql = query.mock.calls.map(([sql]) => String(sql)).join(' ');
    expect(downSql).toMatch(/DROP COLUMN IF EXISTS "SolicitudSalidaId"/i);
    expect(downSql).not.toMatch(/DELETE FROM motivos_salida/i);
  });
});
