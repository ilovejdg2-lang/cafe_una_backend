import { MigrationInterface, QueryRunner } from 'typeorm';

export class PropuestaUbicacion20261010020000 implements MigrationInterface {
  name = 'PropuestaUbicacion20261010020000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE propuestas_productores
        ADD COLUMN IF NOT EXISTS "Provincia" varchar(80),
        ADD COLUMN IF NOT EXISTS "Canton" varchar(80),
        ADD COLUMN IF NOT EXISTS "Distrito" varchar(80);
    `);
    await queryRunner.query(`
      ALTER TABLE propuestas_productores
        ALTER COLUMN "Direccion" TYPE varchar(500);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE propuestas_productores
        DROP COLUMN IF EXISTS "Distrito",
        DROP COLUMN IF EXISTS "Canton",
        DROP COLUMN IF EXISTS "Provincia";
    `);
    await queryRunner.query(`
      ALTER TABLE propuestas_productores
        ALTER COLUMN "Direccion" TYPE varchar(200);
    `);
  }
}
