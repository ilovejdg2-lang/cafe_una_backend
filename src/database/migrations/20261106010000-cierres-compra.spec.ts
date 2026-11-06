import { QueryRunner } from 'typeorm';
import { CierresCompra20261106010000 } from './20261106010000-cierres-compra';

describe('CierresCompra20261106010000', () => {
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map(([sql]) => String(sql)).join(' ');

  it('creates the table and the (fecha, punto) unique index idempotently', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new CierresCompra20261106010000().up({
      query,
    } as unknown as QueryRunner);

    const upSql = sqlOf(query);
    expect(upSql).toMatch(/CREATE TABLE IF NOT EXISTS cierres_compra/);
    expect(upSql).toMatch(/"Fecha" date NOT NULL/);
    expect(upSql).toMatch(/"UbicacionId" integer NULL\s+REFERENCES inventario_ubicaciones\("Id"\)/);
    expect(upSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cierres_compra_fecha_ubicacion"\s+ON cierres_compra \("Fecha", COALESCE\("UbicacionId", 0\)\)/,
    );
    for (const statement of query.mock.calls.map(([sql]) => String(sql))) {
      expect(statement).toMatch(/IF NOT EXISTS/);
    }
  });

  it('drops only its own objects in down', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new CierresCompra20261106010000().down({
      query,
    } as unknown as QueryRunner);

    const downSql = sqlOf(query);
    expect(downSql).toMatch(
      /DROP INDEX IF EXISTS "UQ_cierres_compra_fecha_ubicacion"/,
    );
    expect(downSql).toMatch(/DROP TABLE IF EXISTS cierres_compra/);
    expect(downSql).not.toMatch(/disponibilidad_grupos|inventario_ubicaciones/);
  });
});
