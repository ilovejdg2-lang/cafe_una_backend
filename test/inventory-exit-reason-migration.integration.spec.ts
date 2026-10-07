import { DataSource, QueryRunner } from 'typeorm';
import { createPostgresTestDataSource } from './support/postgres-test-data-source';
import { InventoryExitReason20261006010000 } from '../src/database/migrations/20261006010000-inventory-exit-reason';

const describeIntegration = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

type ReasonRow = { Nombre: string };
type LegacyMovementRow = { Id: string; MotivoSalidaId: number | null; Destinatario: string | null };

describeIntegration('inventory exit reason migration', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let schemaName: string;
  const migration = new InventoryExitReason20261006010000();

  beforeAll(async () => {
    dataSource = createPostgresTestDataSource();
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
  });

  beforeEach(async () => {
    schemaName = `inventory_exit_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await queryRunner.query(`CREATE SCHEMA "${schemaName}"`);
    await queryRunner.query(`SET search_path TO "${schemaName}"`);
    await queryRunner.query(`
      CREATE TABLE movimientos_inventario (
        "Id" bigserial PRIMARY KEY,
        "Tipo" varchar(30) NOT NULL,
        "ProductoId" bigint NOT NULL,
        "Cantidad" integer NOT NULL,
        "Responsable" varchar(200) NOT NULL DEFAULT '',
        "ResponsableId" integer NULL,
        "Observaciones" varchar(500) NOT NULL DEFAULT '',
        "Notas" varchar(500) NOT NULL DEFAULT '',
        "Fecha" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "CK_movimientos_inventario_tipo"
          CHECK ("Tipo" IN ('entrada', 'transferencia', 'venta_presencial', 'venta_web'))
      )
    `);
    await queryRunner.query(`
      INSERT INTO movimientos_inventario ("Tipo", "ProductoId", "Cantidad", "Notas")
      VALUES ('venta_web', 101, 2, 'movimiento previo a la clasificación')
    `);
  });

  afterAll(async () => {
    if (queryRunner?.isReleased === false) {
      await queryRunner.release();
    }
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  afterEach(async () => {
    if (schemaName) {
      await queryRunner.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await queryRunner.query('SET search_path TO public');
    }
  });

  it('seeds canonical reasons and preserves unclassified historical movements', async () => {
    await migration.up(queryRunner);

    const reasons = (await queryRunner.query(
      'SELECT "Nombre" FROM motivos_salida ORDER BY "Id"',
    )) as ReasonRow[];
    expect(reasons.map((row) => row.Nombre)).toEqual([
      'Venta',
      'Donación',
      'Traslado',
      'Ajuste por merma',
    ]);

    const historical = (await queryRunner.query(
      'SELECT "Id", "MotivoSalidaId", "Destinatario" FROM movimientos_inventario',
    )) as LegacyMovementRow[];
    expect(historical).toEqual([
      { Id: '1', MotivoSalidaId: null, Destinatario: null },
    ]);

    await queryRunner.query(
      `INSERT INTO movimientos_inventario ("Tipo", "ProductoId", "Cantidad", "MotivoSalidaId", "Destinatario") VALUES ('salida_bodega', 101, 1, 2, 'Fundación Café UNA')`,
    );
    await expect(
      queryRunner.query(
        'SELECT "MotivoSalidaId", "Destinatario" FROM movimientos_inventario WHERE "Id" = 2',
      ),
    ).resolves.toEqual([
      { MotivoSalidaId: 2, Destinatario: 'Fundación Café UNA' },
    ]);
  });

  it('enforces a valid catalog foreign key and allows exact rollback without deleting history', async () => {
    await migration.up(queryRunner);

    await expect(
      queryRunner.query(
        `INSERT INTO movimientos_inventario ("Tipo", "ProductoId", "Cantidad", "MotivoSalidaId") VALUES ('salida_bodega', 101, 1, 9999)`,
      ),
    ).rejects.toThrow();

    await queryRunner.query(
      `INSERT INTO movimientos_inventario ("Tipo", "ProductoId", "Cantidad", "MotivoSalidaId") VALUES ('salida_bodega', 101, 1, 1)`,
    );
    await expect(
      queryRunner.query('DELETE FROM motivos_salida WHERE "Id" = 1'),
    ).rejects.toThrow();

    await migration.down(queryRunner);
    await expect(queryRunner.hasTable('motivos_salida')).resolves.toBe(false);
    await expect(queryRunner.hasColumn('movimientos_inventario', 'MotivoSalidaId')).resolves.toBe(false);
    await expect(
      queryRunner.query(
        'SELECT "Tipo", "Notas" FROM movimientos_inventario ORDER BY "Id"',
      ),
    ).resolves.toEqual([
      { Tipo: 'venta_web', Notas: 'movimiento previo a la clasificación' },
      { Tipo: 'salida_bodega', Notas: '' },
    ]);
    await expect(
      queryRunner.query(
        `INSERT INTO movimientos_inventario ("Tipo", "ProductoId", "Cantidad") VALUES ('salida_bodega', 101, 1)`,
      ),
    ).resolves.toBeDefined();
    await expect(
      queryRunner.query(
        'SELECT "Tipo" FROM movimientos_inventario ORDER BY "Id" DESC LIMIT 1',
      ),
    ).resolves.toEqual([{ Tipo: 'salida_bodega' }]);
  });
});
