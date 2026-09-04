import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'movimientos_inventario';

export class HistorialMovimientosInventario20260904010000
  implements MigrationInterface
{
  name = 'HistorialMovimientosInventario20260904010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        "Id" bigserial PRIMARY KEY,
        "Tipo" varchar(30) NOT NULL,
        "ProductoId" bigint NOT NULL,
        "Cantidad" integer NOT NULL,
        "Responsable" varchar(200) NOT NULL DEFAULT '',
        "ResponsableId" integer NULL,
        "Observaciones" varchar(500) NOT NULL DEFAULT '',
        "Notas" varchar(500) NOT NULL DEFAULT '',
        "SolicitudId" bigint NULL,
        "UbicacionId" integer NULL,
        "UbicacionOrigenId" integer NULL,
        "UbicacionDestinoId" integer NULL,
        "Fecha" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "CK_movimientos_inventario_cantidad_positiva"
          CHECK ("Cantidad" > 0)
      );
    `);

    await queryRunner.query(
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS "UbicacionOrigenId" integer NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS "UbicacionDestinoId" integer NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS "UbicacionId" integer NULL;`,
    );

    await queryRunner.query(`
      UPDATE ${TABLE}
      SET "Tipo" = 'venta_presencial'
      WHERE lower(replace(btrim("Tipo"), ' ', '_')) IN ('venta_presencial', 'venta');
    `);
    await queryRunner.query(`
      UPDATE ${TABLE}
      SET "Tipo" = 'venta_web'
      WHERE lower(replace(btrim("Tipo"), ' ', '_')) = 'venta_web';
    `);
    await queryRunner.query(`
      UPDATE ${TABLE}
      SET "Tipo" = 'transferencia'
      WHERE lower(btrim("Tipo")) = 'transferencia';
    `);
    await queryRunner.query(`
      UPDATE ${TABLE}
      SET "Tipo" = 'entrada'
      WHERE "Tipo" IS NULL OR btrim("Tipo") = '' OR lower(btrim("Tipo")) = 'entrada';
    `);

    await queryRunner.query(`
      UPDATE ${TABLE}
      SET "UbicacionOrigenId" = COALESCE("UbicacionOrigenId", "UbicacionId")
      WHERE "Tipo" IN ('venta_presencial', 'venta_web', 'transferencia')
        AND "UbicacionOrigenId" IS NULL
        AND "UbicacionId" IS NOT NULL;
    `);
    await queryRunner.query(`
      UPDATE ${TABLE}
      SET "UbicacionDestinoId" = COALESCE("UbicacionDestinoId", "UbicacionId")
      WHERE "Tipo" IN ('entrada', 'transferencia')
        AND "UbicacionDestinoId" IS NULL
        AND "UbicacionId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_movimientos_inventario_ProductoId"
        ON ${TABLE} ("ProductoId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_movimientos_inventario_Tipo"
        ON ${TABLE} ("Tipo");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_movimientos_inventario_Fecha"
        ON ${TABLE} ("Fecha");
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CK_movimientos_inventario_tipo'
        ) THEN
          ALTER TABLE ${TABLE}
            ADD CONSTRAINT "CK_movimientos_inventario_tipo"
            CHECK ("Tipo" IN ('entrada', 'transferencia', 'venta_presencial', 'venta_web'));
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_movimientos_inventario_append_only()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'El historial de movimientos es de solo inserción.';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_movimientos_inventario_no_update ON ${TABLE};
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_movimientos_inventario_no_update
        BEFORE UPDATE ON ${TABLE}
        FOR EACH ROW
        EXECUTE FUNCTION fn_movimientos_inventario_append_only();
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_movimientos_inventario_no_delete ON ${TABLE};
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_movimientos_inventario_no_delete
        BEFORE DELETE ON ${TABLE}
        FOR EACH ROW
        EXECUTE FUNCTION fn_movimientos_inventario_append_only();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_movimientos_inventario_no_update ON ${TABLE};`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_movimientos_inventario_no_delete ON ${TABLE};`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS fn_movimientos_inventario_append_only();`,
    );
    await queryRunner.query(`
      ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS "CK_movimientos_inventario_tipo";
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_movimientos_inventario_Tipo";`,
    );
  }
}
