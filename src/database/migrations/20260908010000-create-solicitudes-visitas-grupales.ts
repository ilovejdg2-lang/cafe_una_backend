import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSolicitudesVisitasGrupales20260908010000 implements MigrationInterface {
  name = 'CreateSolicitudesVisitasGrupales20260908010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_visitas_grupales (
        "Id" bigserial PRIMARY KEY,
        "UserId" varchar(100) NULL,
        "FechaSolicitud" varchar(20) NOT NULL,
        "Estado" varchar(30) NOT NULL DEFAULT 'Pendiente',
        "EncargadoNombre" varchar(200) NOT NULL,
        "EncargadoIdentificacion" varchar(100) NOT NULL,
        "EncargadoEmail" varchar(200) NOT NULL,
        "EncargadoTelefono" varchar(50) NOT NULL,
        "EncargadoInstitucion" varchar(200) NULL,
        "TipoVisitante" varchar(50) NOT NULL,
        "PaisProcedencia" varchar(100) NULL,
        "CiudadProvincia" varchar(100) NOT NULL,
        "CantidadVisitantes" integer NOT NULL,
        "TipoGrupo" varchar(100) NOT NULL,
        "TipoGrupoOtro" varchar(200) NULL,
        "FechaVisita" varchar(20) NOT NULL,
        "HoraPreferida" varchar(100) NOT NULL,
        "FechaAlternativa" varchar(20) NULL,
        "DuracionEstimada" varchar(100) NULL,
        "AreaVisita" varchar(200) NULL,
        "MotivoVisita" varchar(200) NOT NULL,
        "MotivoOtro" varchar(200) NULL,
        "RequiereAccesibilidad" boolean NOT NULL DEFAULT false,
        "RequiereParqueoBus" boolean NOT NULL DEFAULT false,
        "RequiereGuia" boolean NOT NULL DEFAULT false,
        "Observaciones" varchar(2000) NULL,
        "ObservacionesAdmin" varchar(2000) NULL,
        CONSTRAINT "CK_visitas_cantidad_grupal" CHECK ("CantidadVisitantes" >= 2)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_visitas_UserId"
        ON solicitudes_visitas_grupales ("UserId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_visitas_Estado_FechaVisita"
        ON solicitudes_visitas_grupales ("Estado", "FechaVisita");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visitas_Estado_FechaVisita";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_visitas_UserId";`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS solicitudes_visitas_grupales;`,
    );
  }
}
