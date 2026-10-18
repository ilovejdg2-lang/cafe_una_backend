import { MigrationInterface, QueryRunner } from 'typeorm';

export class PuntoVentaContacto20261017210000 implements MigrationInterface {
  name = 'PuntoVentaContacto20261017210000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventario_ubicaciones
        ADD COLUMN IF NOT EXISTS "Telefono" varchar(40) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE inventario_ubicaciones
        ADD COLUMN IF NOT EXISTS "Horario" varchar(300) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE inventario_ubicaciones
        ADD COLUMN IF NOT EXISTS "Imagenes" text NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventario_ubicaciones
        DROP COLUMN IF EXISTS "Imagenes",
        DROP COLUMN IF EXISTS "Horario",
        DROP COLUMN IF EXISTS "Telefono"
    `);
  }
}
