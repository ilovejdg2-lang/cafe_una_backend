import { MigrationInterface, QueryRunner } from 'typeorm';

export class PurchaseModelRelations20260913010000
  implements MigrationInterface
{
  name = 'PurchaseModelRelations20260913010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE facturas (
        "Id" varchar(80) PRIMARY KEY,
        "CreadaEn" timestamptz NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE TABLE compras_factura_id_legacy (
        "CompraId" integer PRIMARY KEY,
        "FacturaId" varchar(80) NULL
      );
    `);
    await queryRunner.query(`
      INSERT INTO compras_factura_id_legacy ("CompraId", "FacturaId")
      SELECT "Id", "FacturaId" FROM compras;
    `);
    await queryRunner.query(`
      UPDATE compras
      SET "FacturaId" = NULLIF(btrim("FacturaId"), '')
      WHERE "FacturaId" IS NOT NULL;
    `);
    await queryRunner.query(`
      INSERT INTO facturas ("Id")
      SELECT DISTINCT btrim("FacturaId")
      FROM compras
      WHERE "FacturaId" IS NOT NULL AND btrim("FacturaId") <> ''
      ON CONFLICT ("Id") DO NOTHING;
    `);

    // Retain every original key so rollback can restore it exactly.
    await queryRunner.query(`
      CREATE TABLE compra_items_producto_id_legacy (
        "CompraItemId" integer PRIMARY KEY,
        "ProductoId" varchar(40) NOT NULL
      );
    `);
    await queryRunner.query(`
      INSERT INTO compra_items_producto_id_legacy ("CompraItemId", "ProductoId")
      SELECT "Id", "ProductoId" FROM compra_items;
    `);

    // Invalid or orphaned product keys remain historical item snapshots but
    // become NULL, allowing the new FK to protect future values.
    await queryRunner.query(`
      ALTER TABLE compra_items
      ALTER COLUMN "ProductoId" DROP DEFAULT,
      ALTER COLUMN "ProductoId" DROP NOT NULL,
      ALTER COLUMN "ProductoId" TYPE bigint
      USING CASE
        WHEN btrim("ProductoId") ~ '^[0-9]+$' THEN
          CASE
            WHEN length(ltrim(btrim("ProductoId"), '0')) <= 19
              AND COALESCE(NULLIF(ltrim(btrim("ProductoId"), '0'), ''), '0')::numeric
                <= 9223372036854775807
              THEN COALESCE(NULLIF(ltrim(btrim("ProductoId"), '0'), ''), '0')::bigint
            ELSE NULL
          END
        ELSE NULL
      END;
    `);
    await queryRunner.query(`
      UPDATE compra_items AS item
      SET "ProductoId" = NULL
      WHERE "ProductoId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM productos AS producto
          WHERE producto."Id" = item."ProductoId"
        );
    `);

    await queryRunner.query(`
      ALTER TABLE compras
      ADD CONSTRAINT "FK_compras_FacturaId"
      FOREIGN KEY ("FacturaId") REFERENCES facturas("Id")
      ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE compra_items
      ADD CONSTRAINT "FK_compra_items_ProductoId"
      FOREIGN KEY ("ProductoId") REFERENCES productos("Id")
      ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      CREATE TABLE pagos (
        "Id" serial PRIMARY KEY,
        "CompraId" integer NOT NULL REFERENCES compras("Id") ON DELETE CASCADE,
        "Monto" numeric(14,2) NOT NULL,
        "Metodo" varchar(50) NOT NULL,
        "Estado" varchar(40) NOT NULL DEFAULT 'Pendiente',
        "Fecha" timestamptz NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_pagos_CompraId" ON pagos ("CompraId");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE pagos;');
    await queryRunner.query(
      'ALTER TABLE compra_items DROP CONSTRAINT "FK_compra_items_ProductoId";',
    );
    await queryRunner.query(`
      ALTER TABLE compra_items
      ALTER COLUMN "ProductoId" TYPE varchar(40) USING "ProductoId"::varchar;
    `);
    await queryRunner.query(`
      UPDATE compra_items SET "ProductoId" = '' WHERE "ProductoId" IS NULL;
    `);
    await queryRunner.query(`
      UPDATE compra_items AS item
      SET "ProductoId" = legacy."ProductoId"
      FROM compra_items_producto_id_legacy AS legacy
      WHERE legacy."CompraItemId" = item."Id";
    `);
    await queryRunner.query(`
      ALTER TABLE compra_items
      ALTER COLUMN "ProductoId" SET DEFAULT '',
      ALTER COLUMN "ProductoId" SET NOT NULL;
    `);
    await queryRunner.query('DROP TABLE compra_items_producto_id_legacy;');
    await queryRunner.query(
      'ALTER TABLE compras DROP CONSTRAINT "FK_compras_FacturaId";',
    );
    await queryRunner.query(`
      UPDATE compras AS compra
      SET "FacturaId" = legacy."FacturaId"
      FROM compras_factura_id_legacy AS legacy
      WHERE legacy."CompraId" = compra."Id";
    `);
    await queryRunner.query('DROP TABLE compras_factura_id_legacy;');
    await queryRunner.query('DROP TABLE facturas;');
  }
}
