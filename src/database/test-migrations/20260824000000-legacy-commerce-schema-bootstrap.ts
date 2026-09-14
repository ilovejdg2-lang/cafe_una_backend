import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Test-only baseline for the legacy commerce tables that predate this
 * repository's TypeORM migration history. Production already owns these
 * tables; the baseline exists solely so the local disposable-database CLI
 * flow can exercise every incremental migration from an empty database.
 */
export class LegacyCommerceSchemaBootstrap20260824000000
  implements MigrationInterface
{
  name = 'LegacyCommerceSchemaBootstrap20260824000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS productos (
        "Id" bigserial PRIMARY KEY,
        "Stock" integer NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS galeria_institucional (
        "Id" bigserial PRIMARY KEY
      );
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS compras (
        "Id" serial PRIMARY KEY,
        "FacturaId" varchar(80) NULL
      );
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS compra_items (
        "Id" serial PRIMARY KEY,
        "CompraId" integer NOT NULL,
        "ProductoId" varchar(40) NOT NULL DEFAULT ''
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS compra_items;');
    await queryRunner.query('DROP TABLE IF EXISTS compras;');
    await queryRunner.query('DROP TABLE IF EXISTS galeria_institucional;');
    await queryRunner.query('DROP TABLE IF EXISTS productos;');
  }
}
