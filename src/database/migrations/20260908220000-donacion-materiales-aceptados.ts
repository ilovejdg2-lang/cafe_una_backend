import { MigrationInterface, QueryRunner } from 'typeorm';

export class DonacionMaterialesAceptados20260908220000
  implements MigrationInterface
{
  name = 'DonacionMaterialesAceptados20260908220000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS donacion_materiales_aceptados (
        "Id" serial PRIMARY KEY,
        "NecesidadId" integer NOT NULL REFERENCES donacion_necesidades("Id") ON DELETE RESTRICT,
        "Nombre" varchar(200) NOT NULL,
        "Descripcion" varchar(500) NOT NULL DEFAULT '',
        "Estado" varchar(10) NOT NULL DEFAULT 'ACTIVA',
        "CreatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "UpdatedAt" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "CK_donacion_materiales_estado"
          CHECK ("Estado" IN ('ACTIVA', 'INACTIVA'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_donacion_materiales_NecesidadId"
        ON donacion_materiales_aceptados ("NecesidadId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_donacion_materiales_Estado"
        ON donacion_materiales_aceptados ("Estado");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS donacion_materiales_aceptados;`,
    );
  }
}
