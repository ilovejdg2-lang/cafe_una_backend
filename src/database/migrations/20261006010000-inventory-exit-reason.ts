import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryExitReason20261006010000 implements MigrationInterface {
  name = 'InventoryExitReason20261006010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE movimientos_inventario
        DROP CONSTRAINT IF EXISTS "CK_movimientos_inventario_tipo"
    `);
    await queryRunner.query(`
      ALTER TABLE movimientos_inventario
        ADD CONSTRAINT "CK_movimientos_inventario_tipo"
        CHECK ("Tipo" IN (
          'entrada', 'transferencia', 'venta_presencial', 'venta_web', 'salida_bodega'
        ))
    `);
    await queryRunner.query(`
      CREATE TABLE motivos_salida (
        "Id" SERIAL PRIMARY KEY,
        "Nombre" varchar(80) NOT NULL UNIQUE
      )
    `);
    await queryRunner.query(`
      INSERT INTO motivos_salida ("Nombre") VALUES
        ('Venta'), ('Donación'), ('Traslado'), ('Ajuste por merma')
    `);
    await queryRunner.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN "MotivoSalidaId" integer NULL,
        ADD COLUMN "Destinatario" varchar(200) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE movimientos_inventario
        ADD CONSTRAINT "FK_movimientos_inventario_motivo_salida"
        FOREIGN KEY ("MotivoSalidaId") REFERENCES motivos_salida("Id")
        ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_movimientos_inventario_motivo_salida_id"
      ON movimientos_inventario ("MotivoSalidaId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_movimientos_inventario_motivo_salida_id"',
    );
    await queryRunner.query(`
      ALTER TABLE movimientos_inventario
        DROP CONSTRAINT IF EXISTS "FK_movimientos_inventario_motivo_salida",
        DROP COLUMN IF EXISTS "MotivoSalidaId",
        DROP COLUMN IF EXISTS "Destinatario"
    `);
    await queryRunner.query('DROP TABLE IF EXISTS motivos_salida');
    // Keep the new ledger type valid even after reason metadata is rolled back.
    await queryRunner.query(`
      ALTER TABLE movimientos_inventario
        DROP CONSTRAINT IF EXISTS "CK_movimientos_inventario_tipo"
    `);
    await queryRunner.query(`
      ALTER TABLE movimientos_inventario
        ADD CONSTRAINT "CK_movimientos_inventario_tipo"
        CHECK ("Tipo" IN (
          'entrada', 'transferencia', 'venta_presencial', 'venta_web', 'salida_bodega'
        ))
    `);
  }
}
