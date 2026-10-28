import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryStockReservations20261027010000 implements MigrationInterface {
  name = 'InventoryStockReservations20261027010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventario_stock_ubicaciones
        ADD COLUMN "StockReservado" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE inventario_stock_ubicaciones
        ADD CONSTRAINT "CK_inventario_stock_reservado_valido"
        CHECK ("StockReservado" >= 0 AND "StockReservado" <= "Stock")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventario_stock_ubicaciones
        DROP CONSTRAINT IF EXISTS "CK_inventario_stock_reservado_valido"
    `);
    await queryRunner.query(`
      ALTER TABLE inventario_stock_ubicaciones
        DROP COLUMN IF EXISTS "StockReservado"
    `);
  }
}
