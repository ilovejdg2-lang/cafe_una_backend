import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryExitRequests20261027020000 implements MigrationInterface {
  name = 'InventoryExitRequests20261027020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO motivos_salida ("Nombre") VALUES ('Regalía')
      ON CONFLICT ("Nombre") DO NOTHING
    `);
    await queryRunner.query(`
      CREATE TABLE solicitudes_salida_inventario (
        "Id" BIGSERIAL PRIMARY KEY,
        "Tipo" varchar(16) NOT NULL CHECK ("Tipo" IN ('donacion', 'regalia')),
        "Estado" varchar(16) NOT NULL DEFAULT 'pendiente'
          CHECK ("Estado" IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
        "FechaSalida" date NOT NULL,
        "MotivoSalidaId" integer NOT NULL REFERENCES motivos_salida("Id") ON DELETE RESTRICT,
        "Destinatario" varchar(200) NOT NULL,
        "ResponsableNombre" varchar(200) NOT NULL,
        "SolicitanteId" integer NOT NULL REFERENCES usuarios("Id") ON DELETE RESTRICT,
        "RevisorId" integer NULL REFERENCES usuarios("Id") ON DELETE RESTRICT,
        "FechaRevision" timestamptz NULL,
        "ComentarioRevision" varchar(500) NULL,
        "CreadaEn" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE solicitudes_salida_inventario_items (
        "Id" BIGSERIAL PRIMARY KEY,
        "SolicitudId" bigint NOT NULL REFERENCES solicitudes_salida_inventario("Id") ON DELETE CASCADE,
        "ProductoId" bigint NOT NULL REFERENCES productos("Id") ON DELETE RESTRICT,
        "Cantidad" integer NOT NULL CHECK ("Cantidad" > 0),
        CONSTRAINT "UQ_solicitud_salida_inventario_item_producto"
          UNIQUE ("SolicitudId", "ProductoId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE auditoria_solicitud_salida_inventario (
        "Id" BIGSERIAL PRIMARY KEY,
        "SolicitudId" bigint NOT NULL REFERENCES solicitudes_salida_inventario("Id") ON DELETE CASCADE,
        "Accion" varchar(16) NOT NULL,
        "EstadoAnterior" varchar(16) NULL,
        "EstadoNuevo" varchar(16) NOT NULL,
        "ActorId" integer NOT NULL REFERENCES usuarios("Id") ON DELETE RESTRICT,
        "Comentario" varchar(500) NULL,
        "CreadaEn" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_solicitud_salida_estado_fecha"
        ON solicitudes_salida_inventario ("Estado", "CreadaEn" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auditoria_solicitud_salida_fecha"
        ON auditoria_solicitud_salida_inventario ("SolicitudId", "CreadaEn")
    `);
    await queryRunner.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN "SolicitudSalidaId" bigint NULL
          REFERENCES solicitudes_salida_inventario("Id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_movimiento_salida_solicitud_producto"
        ON movimientos_inventario ("SolicitudSalidaId", "ProductoId")
        WHERE "SolicitudSalidaId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_movimiento_salida_solicitud_producto"',
    );
    await queryRunner.query(
      'ALTER TABLE movimientos_inventario DROP COLUMN IF EXISTS "SolicitudSalidaId"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_auditoria_solicitud_salida_fecha"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_solicitud_salida_estado_fecha"',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS auditoria_solicitud_salida_inventario',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS solicitudes_salida_inventario_items',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS solicitudes_salida_inventario',
    );
  }
}
