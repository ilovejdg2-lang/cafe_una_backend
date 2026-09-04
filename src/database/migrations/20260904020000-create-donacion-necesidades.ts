import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDonacionNecesidadesTable20260904020000
  implements MigrationInterface
{
  name = 'CreateDonacionNecesidadesTable20260904020000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS donacion_necesidades (
        "Id" serial PRIMARY KEY,
        "Uuid" uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        "Titulo" varchar(200) NOT NULL,
        "Descripcion" varchar(2000) NOT NULL,
        "Prioridad" varchar(10) NOT NULL,
        "CantidadRequerida" integer NULL,
        "Estado" varchar(10) NOT NULL DEFAULT 'ACTIVA',
        "CreatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "UpdatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "DeletedAt" timestamptz NULL,
        CONSTRAINT "CK_donacion_necesidades_prioridad"
          CHECK ("Prioridad" IN ('ALTA', 'MEDIA', 'BAJA')),
        CONSTRAINT "CK_donacion_necesidades_estado"
          CHECK ("Estado" IN ('ACTIVA', 'INACTIVA')),
        CONSTRAINT "CK_donacion_necesidades_cantidad"
          CHECK ("CantidadRequerida" IS NULL OR "CantidadRequerida" > 0)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_donacion_necesidades_Estado"
        ON donacion_necesidades ("Estado");
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS donacion_solicitudes (
        "Id" serial PRIMARY KEY,
        "UsuarioId" integer NOT NULL,
        "NecesidadId" integer NULL REFERENCES donacion_necesidades("Id") ON DELETE SET NULL,
        "Tipo" varchar(200) NOT NULL,
        "Descripcion" varchar(2000) NOT NULL,
        "FechaPropuesta" date NOT NULL,
        "Estado" varchar(20) NOT NULL DEFAULT 'Pendiente',
        "CreatedAt" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "CK_donacion_solicitudes_estado"
          CHECK ("Estado" IN ('Pendiente', 'Aceptada', 'Rechazada'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_donacion_solicitudes_UsuarioId"
        ON donacion_solicitudes ("UsuarioId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_donacion_solicitudes_Estado"
        ON donacion_solicitudes ("Estado");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_donacion_solicitudes_Estado";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_donacion_solicitudes_UsuarioId";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS donacion_solicitudes;`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_donacion_necesidades_Estado";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS donacion_necesidades;`);
  }
}
