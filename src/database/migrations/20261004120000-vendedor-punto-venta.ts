import { MigrationInterface, QueryRunner } from 'typeorm';

export class VendedorPuntoVenta20261004120000 implements MigrationInterface {
  name = 'VendedorPuntoVenta20261004120000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendedor_punto_venta (
        "Id" serial PRIMARY KEY,
        "VendedorId" integer NOT NULL,
        "UbicacionId" integer NOT NULL,
        "Activo" boolean NOT NULL DEFAULT true,
        "CreadoEn" timestamptz NOT NULL DEFAULT NOW(),
        "ActualizadoEn" timestamptz NOT NULL DEFAULT NOW(),
        "AsignadoPorId" integer NULL,
        CONSTRAINT "UQ_vendedor_punto_venta" UNIQUE ("VendedorId", "UbicacionId"),
        CONSTRAINT "FK_vendedor_punto_venta_vendedor"
          FOREIGN KEY ("VendedorId") REFERENCES usuarios ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_vendedor_punto_venta_ubicacion"
          FOREIGN KEY ("UbicacionId") REFERENCES inventario_ubicaciones ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_vendedor_punto_venta_asignado_por"
          FOREIGN KEY ("AsignadoPorId") REFERENCES usuarios ("Id") ON DELETE SET NULL
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS vendedor_punto_venta;`);
  }
}
