import { MigrationInterface, QueryRunner } from 'typeorm';

export class DonacionSolicitudesDetalles20260904180000
  implements MigrationInterface
{
  name = 'DonacionSolicitudesDetalles20260904180000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE donacion_solicitudes
        ADD COLUMN IF NOT EXISTS "Detalles" jsonb NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE donacion_solicitudes DROP COLUMN IF EXISTS "Detalles";
    `);
  }
}
