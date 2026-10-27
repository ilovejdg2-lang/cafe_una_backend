import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductorCoordenadas20261027010000 implements MigrationInterface {
  name = 'ProductorCoordenadas20261027010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE propuestas_productores
        ADD COLUMN IF NOT EXISTS "Latitud" double precision NULL,
        ADD COLUMN IF NOT EXISTS "Longitud" double precision NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE productores_activos
        ADD COLUMN IF NOT EXISTS "Latitud" double precision NULL,
        ADD COLUMN IF NOT EXISTS "Longitud" double precision NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE productores_activos
        DROP COLUMN IF EXISTS "Longitud",
        DROP COLUMN IF EXISTS "Latitud";
    `);
    await queryRunner.query(`
      ALTER TABLE propuestas_productores
        DROP COLUMN IF EXISTS "Longitud",
        DROP COLUMN IF EXISTS "Latitud";
    `);
  }
}
