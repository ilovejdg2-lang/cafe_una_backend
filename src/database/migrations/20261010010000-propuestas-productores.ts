import { MigrationInterface, QueryRunner } from 'typeorm';

export class PropuestasProductores20261010010000 implements MigrationInterface {
  name = 'PropuestasProductores20261010010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS propuestas_productores (
        "Id" bigserial PRIMARY KEY,
        "UsuarioId" integer NOT NULL,
        "NombreEmprendimiento" varchar(100) NOT NULL,
        "ImagenReferencia" varchar(200) NOT NULL,
        "Direccion" varchar(200) NOT NULL,
        "EnlaceUbicacion" varchar(500) NOT NULL,
        "Descripcion" varchar(2000) NOT NULL,
        "Facebook" varchar(500) NULL,
        "Instagram" varchar(500) NULL,
        "Whatsapp" varchar(80) NULL,
        "SitioWeb" varchar(500) NULL,
        "CorreoContacto" varchar(200) NOT NULL,
        "TelefonoContacto" varchar(20) NOT NULL,
        "Estado" varchar(20) NOT NULL DEFAULT 'Pendiente',
        "TerminosAceptadosEn" timestamptz NOT NULL,
        "TerminosVersion" varchar(40) NOT NULL,
        "ClaveIdempotencia" varchar(80) NOT NULL,
        "CreadoEn" timestamptz NOT NULL DEFAULT NOW(),
        "ActualizadoEn" timestamptz NOT NULL DEFAULT NOW(),
        "RevisadoEn" timestamptz NULL,
        "RevisadoPorId" integer NULL,
        "MotivoRechazo" varchar(1000) NULL,
        CONSTRAINT "CK_propuestas_productores_estado"
          CHECK ("Estado" IN ('Pendiente', 'Aprobada', 'Rechazada')),
        CONSTRAINT "UQ_propuestas_productores_idempotencia"
          UNIQUE ("UsuarioId", "ClaveIdempotencia"),
        CONSTRAINT "FK_propuestas_productores_usuario"
          FOREIGN KEY ("UsuarioId") REFERENCES usuarios ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_propuestas_productores_revisor"
          FOREIGN KEY ("RevisadoPorId") REFERENCES usuarios ("Id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_propuestas_productores_usuario"
        ON propuestas_productores ("UsuarioId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_propuestas_productores_estado_fecha"
        ON propuestas_productores ("Estado", "CreadoEn" DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_propuestas_productores_correo"
        ON propuestas_productores (LOWER("CorreoContacto"));
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        "Id" serial PRIMARY KEY,
        "UsuarioId" integer NOT NULL,
        "Tipo" varchar(40) NOT NULL,
        "Titulo" varchar(160) NOT NULL,
        "Mensaje" varchar(500) NOT NULL,
        "Enlace" varchar(300) NOT NULL,
        "Leida" boolean NOT NULL DEFAULT false,
        "ClaveUnica" varchar(120) NOT NULL,
        "ReferenciaId" varchar(40) NULL,
        "CreadoEn" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_notificaciones_clave" UNIQUE ("ClaveUnica"),
        CONSTRAINT "FK_notificaciones_usuario"
          FOREIGN KEY ("UsuarioId") REFERENCES usuarios ("Id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_notificaciones_usuario_leida"
        ON notificaciones ("UsuarioId", "Leida");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS correos_salida (
        "Id" serial PRIMARY KEY,
        "ClaveUnica" varchar(120) NOT NULL,
        "Destinatario" varchar(200) NOT NULL,
        "Asunto" varchar(200) NOT NULL,
        "Html" text NOT NULL,
        "Texto" text NOT NULL,
        "Estado" varchar(20) NOT NULL DEFAULT 'pendiente',
        "Intentos" integer NOT NULL DEFAULT 0,
        "ProximoIntento" timestamptz NOT NULL DEFAULT NOW(),
        "UltimoError" varchar(500) NULL,
        "CreadoEn" timestamptz NOT NULL DEFAULT NOW(),
        "EnviadoEn" timestamptz NULL,
        CONSTRAINT "UQ_correos_salida_clave" UNIQUE ("ClaveUnica"),
        CONSTRAINT "CK_correos_salida_estado"
          CHECK ("Estado" IN ('pendiente', 'enviado', 'error'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_correos_salida_pendientes"
        ON correos_salida ("Estado", "ProximoIntento");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS correos_salida;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notificaciones;`);
    await queryRunner.query(`DROP TABLE IF EXISTS propuestas_productores;`);
  }
}
