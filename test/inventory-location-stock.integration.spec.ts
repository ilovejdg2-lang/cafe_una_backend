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

interface LocationIdRow {
  Id: number;
}

interface LocationRow {
  Codigo: string;
  Nombre: string;
}

interface ProductRow {
  Id: string;
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

    const locations = (await queryRunner.query(
      'SELECT "Codigo", "Nombre" FROM inventario_ubicaciones ORDER BY "Id"',
    )) as LocationRow[];
    expect(locations).toEqual([
      { Codigo: 'BODEGA_CENTRAL', Nombre: 'Bodega Central' },
      { Codigo: 'POS_FUNA_UNA', Nombre: 'FUNA-UNA' },
      { Codigo: 'POS_EDITORIAL', Nombre: 'Editorial' },
      { Codigo: 'POS_STAND_FERIAS', Nombre: 'Stand Ferias' },
    ]);

    const balances = (await queryRunner.query(`
      SELECT p."Id" AS "ProductoId", u."Codigo", s."Stock"
      FROM inventario_stock_ubicaciones s
      JOIN productos p ON p."Id" = s."ProductoId"
      JOIN inventario_ubicaciones u ON u."Id" = s."UbicacionId"
      ORDER BY p."Id", u."Id"
    `)) as BalanceRow[];
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

    const centralLocation = (await queryRunner.query(
      `SELECT "Id" FROM inventario_ubicaciones WHERE "Codigo" = 'BODEGA_CENTRAL'`,
    )) as LocationIdRow[];
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

  it('serializes concurrent central updates and preserves the legacy mirror', async () => {
    await applyMigration();

    const centralLocation = (await queryRunner.query(
      `SELECT "Id" FROM inventario_ubicaciones WHERE "Codigo" = 'BODEGA_CENTRAL'`,
    )) as LocationIdRow[];
    const centralId = centralLocation[0].Id;
    const productId = 101;
    const committed: number[] = [];
    const firstRunner = dataSource.createQueryRunner();
    const secondRunner = dataSource.createQueryRunner();
    let secondUpdate: Promise<void> | undefined;

    const updateProductAndBalance = async (
      runner: QueryRunner,
      stock: number,
    ): Promise<void> => {
      await runner.query(`UPDATE productos SET "Stock" = $1 WHERE "Id" = $2`, [
        stock,
        productId,
      ]);
      await runner.query(
        `UPDATE inventario_stock_ubicaciones SET "Stock" = $1 WHERE "ProductoId" = $2 AND "UbicacionId" = $3`,
        [stock, productId, centralId],
      );
    };

    try {
      await firstRunner.connect();
      await secondRunner.connect();
      await firstRunner.startTransaction();
      await firstRunner.query(
        `SELECT "Id" FROM productos WHERE "Id" = $1 FOR UPDATE`,
        [productId],
      );
      await firstRunner.query(
        `SELECT "Id" FROM inventario_stock_ubicaciones WHERE "ProductoId" = $1 AND "UbicacionId" = $2 FOR UPDATE`,
        [productId, centralId],
      );
      await updateProductAndBalance(firstRunner, 7);

      secondUpdate = (async () => {
        await secondRunner.startTransaction();
        await secondRunner.query(
          `SELECT "Id" FROM productos WHERE "Id" = $1 FOR UPDATE`,
          [productId],
        );
        await secondRunner.query(
          `SELECT "Id" FROM inventario_stock_ubicaciones WHERE "ProductoId" = $1 AND "UbicacionId" = $2 FOR UPDATE`,
          [productId, centralId],
        );
        await updateProductAndBalance(secondRunner, 9);
        await secondRunner.commitTransaction();
        committed.push(9);
      })();

      await firstRunner.query('SELECT pg_sleep(0.1)');
      await firstRunner.commitTransaction();
      committed.push(7);
      await secondUpdate;

      expect(committed).toEqual([7, 9]);
      await expect(
        queryRunner.query(
          `SELECT p."Stock" AS "ProductStock", s."Stock" AS "BalanceStock"
           FROM productos p
           JOIN inventario_stock_ubicaciones s ON s."ProductoId" = p."Id"
           WHERE p."Id" = $1 AND s."UbicacionId" = $2`,
          [productId, centralId],
        ),
      ).resolves.toEqual([{ ProductStock: 9, BalanceStock: 9 }]);
    } finally {
      if (secondUpdate) await secondUpdate.catch(() => undefined);
      if (firstRunner.isTransactionActive)
        await firstRunner.rollbackTransaction();
      if (secondRunner.isTransactionActive)
        await secondRunner.rollbackTransaction();
      await firstRunner.release();
      await secondRunner.release();
      await queryRunner.query(
        `UPDATE productos SET "Stock" = $1 WHERE "Id" = $2`,
        [12, productId],
      );
      await queryRunner.query(
        `UPDATE inventario_stock_ubicaciones SET "Stock" = $1 WHERE "ProductoId" = $2 AND "UbicacionId" = $3`,
        [12, productId, centralId],
      );
    }
  });

  it('refuses rollback while balances are not reconciled and preserves legacy products', async () => {
    await applyMigration();

    const posLocation = (await queryRunner.query(
      `SELECT "Id" FROM inventario_ubicaciones WHERE "Codigo" = 'POS_FUNA_UNA'`,
    )) as LocationIdRow[];
    const centralLocation = (await queryRunner.query(
      `SELECT "Id" FROM inventario_ubicaciones WHERE "Codigo" = 'BODEGA_CENTRAL'`,
    )) as LocationIdRow[];

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

    const products = (await queryRunner.query(
      'SELECT "Id", "Stock" FROM productos ORDER BY "Id"',
    )) as ProductRow[];
    expect(products).toEqual([
      { Id: '101', Stock: 12 },
      { Id: '202', Stock: 0 },
    ]);
    await expect(queryRunner.hasTable('inventario_ubicaciones')).resolves.toBe(
      false,
    );
    await expect(
      queryRunner.hasTable('inventario_stock_ubicaciones'),
    ).resolves.toBe(false);
  });
});
