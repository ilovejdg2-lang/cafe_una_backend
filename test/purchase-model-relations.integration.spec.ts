import { DataSource, QueryRunner } from 'typeorm';

import { PurchaseModelRelations20260913010000 } from '../src/database/migrations/20260913010000-purchase-model-relations';
import { createPostgresTestDataSource } from './support/postgres-test-data-source';

const describeIntegration = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

interface ProductReferenceRow {
  Id: number;
  ProductoId: string | null;
}

interface LegacyProductReferenceRow {
  Id: number;
  ProductoId: string;
}

interface InvoiceRow {
  Id: string | null;
}

interface IndexRow {
  indexname: string;
}

describeIntegration('purchase model relations migration', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let schemaName: string;
  const migration = new PurchaseModelRelations20260913010000();

  beforeAll(async () => {
    dataSource = createPostgresTestDataSource();
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    schemaName = `purchase_model_${process.pid}_${Date.now()}`;
    await queryRunner.query(`CREATE SCHEMA "${schemaName}"`);
    await queryRunner.query(`SET search_path TO "${schemaName}"`);
    await queryRunner.query(`
      CREATE TABLE productos ("Id" bigint PRIMARY KEY);
      CREATE TABLE compras (
        "Id" integer PRIMARY KEY,
        "FacturaId" varchar(80) NULL
      );
      CREATE TABLE compra_items (
        "Id" integer PRIMARY KEY,
        "CompraId" integer NOT NULL,
        "ProductoId" varchar(40) NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query('INSERT INTO productos ("Id") VALUES ($1), ($2)', [
      42,
      '9223372036854775807',
    ]);
    await queryRunner.query(
      `INSERT INTO compras ("Id", "FacturaId") VALUES
        (1, ' INV-001 '),
        (2, NULL)`,
    );
    await queryRunner.query(
      `INSERT INTO compra_items ("Id", "CompraId", "ProductoId") VALUES
        (1, 1, '00042'),
        (2, 1, '9223372036854775807'),
        (3, 1, '000'),
        (4, 2, '  42  '),
        (5, 2, '999'),
        (6, 2, '')`,
    );
  });

  afterAll(async () => {
    if (queryRunner?.isReleased === false) {
      await queryRunner.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await queryRunner.release();
    }
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('preserves legacy data and enforces indexed invoice, product, and payment relations', async () => {
    await migration.up(queryRunner);

    const indexes = (await queryRunner.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname IN ('IDX_compras_FacturaId', 'IDX_compra_items_ProductoId')
      ORDER BY indexname
    `)) as IndexRow[];
    expect(indexes).toEqual([
      { indexname: 'IDX_compra_items_ProductoId' },
      { indexname: 'IDX_compras_FacturaId' },
    ]);

    const invoices = (await queryRunner.query(
      'SELECT "Id" FROM facturas ORDER BY "Id"',
    )) as InvoiceRow[];
    expect(invoices).toEqual([{ Id: 'INV-001' }]);

    await expect(
      queryRunner.query(
        'INSERT INTO compras ("Id", "FacturaId") VALUES ($1, $2)',
        [3, 'UNKNOWN-INVOICE'],
      ),
    ).rejects.toThrow();

    const converted = (await queryRunner.query(`
      SELECT "Id", "ProductoId"::text AS "ProductoId"
      FROM compra_items
      ORDER BY "Id"
    `)) as ProductReferenceRow[];
    expect(converted).toEqual([
      { Id: 1, ProductoId: '42' },
      { Id: 2, ProductoId: '9223372036854775807' },
      { Id: 3, ProductoId: null },
      { Id: 4, ProductoId: '42' },
      { Id: 5, ProductoId: null },
      { Id: 6, ProductoId: null },
    ]);

    await expect(
      queryRunner.query(
        'INSERT INTO compra_items ("Id", "CompraId", "ProductoId") VALUES ($1, $2, $3)',
        [7, 1, 404],
      ),
    ).rejects.toThrow();

    await queryRunner.query('DELETE FROM facturas WHERE "Id" = $1', ['INV-001']);
    await expect(
      queryRunner.query('SELECT "FacturaId" AS "Id" FROM compras WHERE "Id" = $1', [1]),
    ).resolves.toEqual([{ Id: null }]);

    await queryRunner.query(
      'INSERT INTO compras ("Id", "FacturaId") VALUES ($1, $2)',
      [3, null],
    );
    await queryRunner.query(
      'INSERT INTO pagos ("CompraId", "Monto", "Metodo") VALUES ($1, $2, $3)',
      [3, '25.00', 'Tarjeta'],
    );
    await queryRunner.query('DELETE FROM compras WHERE "Id" = $1', [3]);
    await expect(
      queryRunner.query('SELECT count(*)::int AS "count" FROM pagos WHERE "CompraId" = $1', [3]),
    ).resolves.toEqual([{ count: 0 }]);

    await migration.down(queryRunner);

    const restored = (await queryRunner.query(`
      SELECT "Id", "ProductoId"
      FROM compra_items
      ORDER BY "Id"
    `)) as LegacyProductReferenceRow[];
    expect(restored).toEqual([
      { Id: 1, ProductoId: '00042' },
      { Id: 2, ProductoId: '9223372036854775807' },
      { Id: 3, ProductoId: '000' },
      { Id: 4, ProductoId: '  42  ' },
      { Id: 5, ProductoId: '999' },
      { Id: 6, ProductoId: '' },
    ]);
  });
});
