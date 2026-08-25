import { DataSource, QueryRunner } from 'typeorm';
import { createPostgresTestDataSource } from './support/postgres-test-data-source';
import { InventoryLocationStockFoundation20260824180000 } from '../src/database/migrations/20260824180000-inventory-location-stock-foundation';

const describeIntegration = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

interface BalanceRow {
  ProductoId: string;
  Codigo: string;
  Stock: number;
}

describeIntegration('inventory location stock foundation migration', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let schemaName: string;
  const migration = new InventoryLocationStockFoundation20260824180000();

  beforeAll(async () => {
    dataSource = createPostgresTestDataSource();
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    schemaName = `inventory_f06_${process.pid}_${Date.now()}`;
    await queryRunner.query(`CREATE SCHEMA "${schemaName}"`);
    await queryRunner.query(`SET search_path TO "${schemaName}"`);
    await queryRunner.query(`
      CREATE TABLE productos (
        "Id" bigint PRIMARY KEY,
        "Stock" integer NOT NULL,
        "EsDestacado" boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(
      `INSERT INTO productos ("Id", "Stock", "EsDestacado") VALUES ($1, $2, $3), ($4, $5, $6)`,
      [101, 12, true, 202, 0, false],
    );
  });

  afterAll(async () => {
    if (queryRunner?.isReleased === false) {
      await queryRunner.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await queryRunner.release();
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  async function applyMigration(): Promise<void> {
    await migration.up(queryRunner);
  }

  it('seeds the four canonical locations idempotently and backfills every product', async () => {
    await applyMigration();
    await applyMigration();

    const locations = await queryRunner.query(
      'SELECT "Codigo", "Nombre" FROM inventario_ubicaciones ORDER BY "Id"',
    );
    expect(locations).toEqual([
      { Codigo: 'BODEGA_CENTRAL', Nombre: 'Bodega Central' },
      { Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA' },
      { Codigo: 'POS_EDITORIAL', Nombre: 'Editorial' },
      { Codigo: 'POS_STAND_FERIAS', Nombre: 'Stand Ferias' },
    ]);

    const balances: BalanceRow[] = await queryRunner.query(`
      SELECT p."Id" AS "ProductoId", u."Codigo", s."Stock"
      FROM inventario_stock_ubicaciones s
      JOIN productos p ON p."Id" = s."ProductoId"
      JOIN inventario_ubicaciones u ON u."Id" = s."UbicacionId"
      ORDER BY p."Id", u."Id"
    `);
    expect(balances).toHaveLength(8);
    expect(balances.filter((row) => row.Codigo === 'BODEGA_CENTRAL')).toEqual([
      { ProductoId: '101', Codigo: 'BODEGA_CENTRAL', Stock: 12 },
      { ProductoId: '202', Codigo: 'BODEGA_CENTRAL', Stock: 0 },
    ]);
    expect(
      balances
        .filter((row) => row.Codigo !== 'BODEGA_CENTRAL')
        .every((row) => row.Stock === 0),
    ).toBe(true);
  });

  it('enforces one balance per product and location and rejects negative stock', async () => {
    await applyMigration();

    const centralLocation = await queryRunner.query(
      `SELECT "Id" FROM inventario_ubicaciones WHERE "Codigo" = 'BODEGA_CENTRAL'`,
    );
    const centralId = centralLocation[0].Id;

    await expect(
      queryRunner.query(
        `INSERT INTO inventario_stock_ubicaciones ("ProductoId", "UbicacionId", "Stock") VALUES ($1, $2, $3)`,
        [101, centralId, 12],
      ),
    ).rejects.toThrow();

    await expect(
      queryRunner.query(
        `INSERT INTO inventario_stock_ubicaciones ("ProductoId", "UbicacionId", "Stock") VALUES ($1, $2, $3)`,
        [101, centralId, -1],
      ),
    ).rejects.toThrow();
  });

  it('refuses rollback while balances are not reconciled and preserves legacy products', async () => {
    await applyMigration();

    const posLocation = await queryRunner.query(
      `SELECT "Id" FROM inventario_ubicaciones WHERE "Codigo" = 'POS_FUNA_UNA'`,
    );
    const centralLocation = await queryRunner.query(
      `SELECT "Id" FROM inventario_ubicaciones WHERE "Codigo" = 'BODEGA_CENTRAL'`,
    );

    await queryRunner.query(
      `UPDATE inventario_stock_ubicaciones SET "Stock" = 3 WHERE "ProductoId" = $1 AND "UbicacionId" = $2`,
      [101, posLocation[0].Id],
    );
    await expect(migration.down(queryRunner)).rejects.toThrow(
      'non-central inventory balances are not empty',
    );

    await queryRunner.query(
      `UPDATE inventario_stock_ubicaciones SET "Stock" = 12 WHERE "ProductoId" = $1 AND "UbicacionId" = $2`,
      [101, centralLocation[0].Id],
    );
    await queryRunner.query(
      `UPDATE inventario_stock_ubicaciones SET "Stock" = 0 WHERE "ProductoId" = $1 AND "UbicacionId" = $2`,
      [101, posLocation[0].Id],
    );
    await migration.down(queryRunner);

    const products = await queryRunner.query(
      'SELECT "Id", "Stock" FROM productos ORDER BY "Id"',
    );
    expect(products).toEqual([
      { Id: '101', Stock: 12 },
      { Id: '202', Stock: 0 },
    ]);
    await expect(
      queryRunner.hasTable('inventario_ubicaciones'),
    ).resolves.toBe(false);
    await expect(
      queryRunner.hasTable('inventario_stock_ubicaciones'),
    ).resolves.toBe(false);
  });
});
