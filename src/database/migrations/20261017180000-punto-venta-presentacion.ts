import { MigrationInterface, QueryRunner } from 'typeorm';

export class PuntoVentaPresentacion20261017180000 implements MigrationInterface {
  name = 'PuntoVentaPresentacion20261017180000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventario_ubicaciones
        ADD COLUMN IF NOT EXISTS "ImagenUrl" varchar(500) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE inventario_ubicaciones
        ADD COLUMN IF NOT EXISTS "Direccion" varchar(300) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE inventario_ubicaciones
        ADD COLUMN IF NOT EXISTS "MapsUrl" varchar(500) NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventario_ubicaciones
        DROP COLUMN IF EXISTS "MapsUrl",
        DROP COLUMN IF EXISTS "Direccion",
        DROP COLUMN IF EXISTS "ImagenUrl"
    `);
  }
}
