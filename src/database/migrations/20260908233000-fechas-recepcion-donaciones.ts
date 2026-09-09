import { MigrationInterface, QueryRunner } from 'typeorm';

export class FechasRecepcionDonaciones20260908233000
  implements MigrationInterface
{
  name = 'FechasRecepcionDonaciones20260908233000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fechas_recepcion_donaciones (
        "Id" serial PRIMARY KEY,
        "Fecha" date NOT NULL,
        "Habilitada" boolean NOT NULL DEFAULT true,
        "Horarios" jsonb NULL DEFAULT '[]'::jsonb,
        "Observaciones" varchar(500) NOT NULL DEFAULT '',
        "CreatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "UpdatedAt" timestamptz NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_fechas_recepcion_donaciones_Fecha"
        ON fechas_recepcion_donaciones ("Fecha");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS fechas_recepcion_donaciones;`,
    );
  }
}
