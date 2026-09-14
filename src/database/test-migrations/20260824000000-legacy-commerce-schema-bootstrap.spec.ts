import { QueryRunner } from 'typeorm';

import { LegacyCommerceSchemaBootstrap20260824000000 } from './20260824000000-legacy-commerce-schema-bootstrap';

describe('LegacyCommerceSchemaBootstrap20260824000000', () => {
  it('creates only the legacy tables required by incremental migrations', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new LegacyCommerceSchemaBootstrap20260824000000().up({
      query,
    } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS productos');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS galeria_institucional');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS compras');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS compra_items');
  });

  it('removes its test-only baseline tables in dependency order', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new LegacyCommerceSchemaBootstrap20260824000000().down({
      query,
    } as unknown as QueryRunner);

    expect(query.mock.calls.map(([statement]) => String(statement))).toEqual([
      'DROP TABLE IF EXISTS compra_items;',
      'DROP TABLE IF EXISTS compras;',
      'DROP TABLE IF EXISTS galeria_institucional;',
      'DROP TABLE IF EXISTS productos;',
    ]);
  });
});
