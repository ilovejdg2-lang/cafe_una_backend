import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

const LOCATIONS = [
  ['BODEGA_CENTRAL', 'Bodega Central'],
  ['POS_FUNA_UNA', 'FUNA-UNA'],
  ['POS_EDITORIAL', 'Editorial'],
  ['POS_STAND_FERIAS', 'Stand Ferias'],
] as const;

const LOCATION_TABLE = 'inventario_ubicaciones';
const BALANCE_TABLE = 'inventario_stock_ubicaciones';
const CENTRAL_CODE = 'BODEGA_CENTRAL';

export class InventoryLocationStockFoundation20260824180000
  implements MigrationInterface
{
  name = 'InventoryLocationStockFoundation20260824180000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.withTransaction(queryRunner, async () => {
      await this.createTables(queryRunner);
      await this.seedLocations(queryRunner);
      await this.assertLegacyStockIsValid(queryRunner);
      await this.backfillBalances(queryRunner);
    });
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.withTransaction(queryRunner, async () => {
      if (!(await this.tableExists(queryRunner, BALANCE_TABLE))) return;

      const nonCentralBalances = await queryRunner.query(`
        SELECT 1
        FROM "${BALANCE_TABLE}" stock
        INNER JOIN "${LOCATION_TABLE}" location
          ON location."Id" = stock."UbicacionId"
        WHERE location."Codigo" <> $1
          AND stock."Stock" <> 0
        LIMIT 1
      `, [CENTRAL_CODE]);
      if (nonCentralBalances.length > 0) {
        throw new Error(
          'Cannot rollback: non-central inventory balances are not empty',
        );
      }

      const centralMismatches = await queryRunner.query(`
        SELECT 1
        FROM "${BALANCE_TABLE}" stock
        INNER JOIN "${LOCATION_TABLE}" location
          ON location."Id" = stock."UbicacionId"
        INNER JOIN "productos" product
          ON product."Id" = stock."ProductoId"
        WHERE location."Codigo" = $1
          AND stock."Stock" <> product."Stock"
        LIMIT 1
      `, [CENTRAL_CODE]);
      if (centralMismatches.length > 0) {
        throw new Error(
          'Cannot rollback: central inventory does not match productos.Stock',
        );
      }

      await queryRunner.dropTable(BALANCE_TABLE, true);
      if (await this.tableExists(queryRunner, LOCATION_TABLE)) {
        await queryRunner.dropTable(LOCATION_TABLE, true);
      }
    });
  }

  private async createTables(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.tableExists(queryRunner, LOCATION_TABLE))) {
      await queryRunner.createTable(
        new Table({
          name: LOCATION_TABLE,
          columns: [
            {
              name: 'Id',
              type: 'integer',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'Codigo',
              type: 'varchar',
              length: '50',
              isNullable: false,
              isUnique: true,
            },
            {
              name: 'Nombre',
              type: 'varchar',
              length: '100',
              isNullable: false,
            },
          ],
        }),
        true,
      );
    }

    if (!(await this.tableExists(queryRunner, BALANCE_TABLE))) {
      await queryRunner.createTable(
        new Table({
          name: BALANCE_TABLE,
          columns: [
            {
              name: 'Id',
              type: 'bigint',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'ProductoId', type: 'bigint', isNullable: false },
            { name: 'UbicacionId', type: 'integer', isNullable: false },
            { name: 'Stock', type: 'integer', isNullable: false },
          ],
          uniques: [
            new TableUnique({
              name: 'UQ_inventario_stock_producto_ubicacion',
              columnNames: ['ProductoId', 'UbicacionId'],
            }),
          ],
          checks: [
            new TableCheck({
              name: 'CK_inventario_stock_no_negativo',
              expression: '"Stock" >= 0',
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_inventario_stock_producto',
              columnNames: ['ProductoId'],
              referencedTableName: 'productos',
              referencedColumnNames: ['Id'],
              onDelete: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_inventario_stock_ubicacion',
              columnNames: ['UbicacionId'],
              referencedTableName: LOCATION_TABLE,
              referencedColumnNames: ['Id'],
              onDelete: 'CASCADE',
            }),
          ],
        }),
        true,
      );
    }
  }

  private async seedLocations(queryRunner: QueryRunner): Promise<void> {
    for (const [code, name] of LOCATIONS) {
      await queryRunner.query(
        `INSERT INTO "${LOCATION_TABLE}" ("Codigo", "Nombre") VALUES ($1, $2) ON CONFLICT ("Codigo") DO NOTHING`,
        [code, name],
      );
    }
  }

  private async assertLegacyStockIsValid(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const invalidRows = await queryRunner.query(`
      SELECT "Id"
      FROM "productos"
      WHERE "Stock" < 0
      LIMIT 1
    `);
    if (invalidRows.length > 0) {
      throw new Error(
        'Cannot backfill inventory balances: productos.Stock contains a negative value',
      );
    }
  }

  private async backfillBalances(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "${BALANCE_TABLE}" ("ProductoId", "UbicacionId", "Stock")
      SELECT
        product."Id",
        location."Id",
        CASE WHEN location."Codigo" = $1 THEN product."Stock" ELSE 0 END
      FROM "productos" product
      CROSS JOIN "${LOCATION_TABLE}" location
      ON CONFLICT ("ProductoId", "UbicacionId") DO NOTHING
    `, [CENTRAL_CODE]);
  }

  private async withTransaction(
    queryRunner: QueryRunner,
    operation: () => Promise<void>,
  ): Promise<void> {
    const ownsTransaction = !queryRunner.isTransactionActive;
    if (ownsTransaction) await queryRunner.startTransaction();

    try {
      await operation();
      if (ownsTransaction) await queryRunner.commitTransaction();
    } catch (error) {
      if (ownsTransaction && queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    }
  }

  private async tableExists(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      'SELECT to_regclass($1) IS NOT NULL AS "exists"',
      [tableName],
    );
    return rows[0]?.exists === true || rows[0]?.exists === 't';
  }
}
