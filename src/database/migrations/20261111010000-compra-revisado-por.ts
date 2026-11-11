import { MigrationInterface, QueryRunner } from 'typeorm';

/** Quién aceptó o rechazó un pedido en línea (vendedor responsable del pedido). */
export class CompraRevisadoPor20261111010000 implements MigrationInterface {
  name = 'CompraRevisadoPor20261111010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE compras
      ADD COLUMN IF NOT EXISTS "RevisadoPorId" integer NULL
    `);
    await queryRunner.query(`
      ALTER TABLE compras
      ADD COLUMN IF NOT EXISTS "RevisadoPorNombre" varchar(150) NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE compras
      ADD COLUMN IF NOT EXISTS "RevisadoPorCorreo" varchar(150) NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE compras DROP COLUMN IF EXISTS "RevisadoPorCorreo"',
    );
    await queryRunner.query(
      'ALTER TABLE compras DROP COLUMN IF EXISTS "RevisadoPorNombre"',
    );
    await queryRunner.query(
      'ALTER TABLE compras DROP COLUMN IF EXISTS "RevisadoPorId"',
    );
  }
}
