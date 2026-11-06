import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fechas sin retiro de pedidos ("Días sin retiro").
 * UbicacionId NULL = aplica a todos los puntos de venta. Una sola fila por
 * (fecha, punto); el índice usa COALESCE porque Postgres trata los NULL como
 * distintos en un índice único simple.
 */
export class CierresCompra20261106010000 implements MigrationInterface {
  name = 'CierresCompra20261106010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cierres_compra (
        "Id" serial PRIMARY KEY,
        "Fecha" date NOT NULL,
        "Nota" varchar(300) NOT NULL DEFAULT '',
        "UbicacionId" integer NULL
          REFERENCES inventario_ubicaciones("Id") ON DELETE CASCADE,
        "CreadoEn" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cierres_compra_fecha_ubicacion"
        ON cierres_compra ("Fecha", COALESCE("UbicacionId", 0))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_cierres_compra_fecha_ubicacion"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS cierres_compra');
  }
}
