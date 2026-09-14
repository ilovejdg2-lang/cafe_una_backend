import { QueryRunner } from 'typeorm';

import { PurchaseModelRelations20260913010000 } from './20260913010000-purchase-model-relations';

describe('PurchaseModelRelations20260913010000', () => {
  it('adds payment and invoice relations while retaining legacy purchase data', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new PurchaseModelRelations20260913010000().up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('CREATE TABLE facturas');
    expect(sql).toContain('CREATE TABLE pagos');
    expect(sql).toContain('CREATE TABLE compras_factura_id_legacy');
    expect(sql).toContain('SET "FacturaId" = NULLIF(btrim("FacturaId"), \'\')');
    expect(sql).toContain('INSERT INTO compras_factura_id_legacy');
    expect(sql).toContain('"CompraId" integer NOT NULL REFERENCES compras("Id") ON DELETE CASCADE');
    expect(sql).toContain('FK_compras_FacturaId');
    expect(sql).toContain('FK_compra_items_ProductoId');
    expect(sql).toContain('compra_items_producto_id_legacy');
    expect(sql).toContain('ALTER COLUMN "ProductoId" TYPE bigint');
    expect(sql).toContain('SET "ProductoId" = NULL');
  });

  it('removes only the newly introduced purchase-model structures on rollback', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new PurchaseModelRelations20260913010000().down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('DROP TABLE pagos');
    expect(sql).toContain('DROP CONSTRAINT "FK_compra_items_ProductoId"');
    expect(sql).toContain('DROP CONSTRAINT "FK_compras_FacturaId"');
    expect(sql).toContain('DROP TABLE facturas');
    expect(sql).toContain('DROP TABLE compra_items_producto_id_legacy');
    expect(sql).toContain('DROP TABLE compras_factura_id_legacy');
    expect(sql).toContain('SET "FacturaId" = legacy."FacturaId"');
    expect(sql).not.toContain('DROP TABLE compras;');
    expect(sql).not.toContain('DROP TABLE compra_items;');
  });
});
