import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDisponibilidadesVisitas20260908020000 implements MigrationInterface {
  name = 'CreateDisponibilidadesVisitas20260908020000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS disponibilidades_visitas (
        "Id" bigserial PRIMARY KEY,
        "Fecha" date NOT NULL,
        "HoraInicio" time NOT NULL,
        "HoraFin" time NOT NULL,
        "Habilitada" boolean NOT NULL DEFAULT true,
        "Nota" varchar(500) NULL,
        CONSTRAINT "UQ_disponibilidades_visitas_fecha_horas"
          UNIQUE ("Fecha", "HoraInicio", "HoraFin"),
        CONSTRAINT "CK_disponibilidades_visitas_horas"
          CHECK ("HoraFin" > "HoraInicio")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disponibilidades_visitas_fecha_habilitada"
        ON disponibilidades_visitas ("Fecha", "Habilitada");
    `);
    await queryRunner.query(`
      ALTER TABLE solicitudes_visitas_grupales
        ADD COLUMN IF NOT EXISTS "DisponibilidadVisitaId" bigint NULL;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_visitas_disponibilidad'
            AND conrelid = 'solicitudes_visitas_grupales'::regclass
        ) THEN
          ALTER TABLE solicitudes_visitas_grupales
            ADD CONSTRAINT "FK_visitas_disponibilidad"
            FOREIGN KEY ("DisponibilidadVisitaId")
            REFERENCES disponibilidades_visitas ("Id")
            ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE solicitudes_visitas_grupales
        DROP CONSTRAINT IF EXISTS "FK_visitas_disponibilidad";
    `);
    await queryRunner.query(`
      ALTER TABLE solicitudes_visitas_grupales
        DROP COLUMN IF EXISTS "DisponibilidadVisitaId";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_disponibilidades_visitas_fecha_habilitada";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS disponibilidades_visitas;`);
  }
}
