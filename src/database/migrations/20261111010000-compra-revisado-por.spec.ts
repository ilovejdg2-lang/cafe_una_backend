import { CompraRevisadoPor20261111010000 } from './20261111010000-compra-revisado-por';

describe('CompraRevisadoPor20261111010000', () => {
  it('adds and drops the reviewer columns on compras', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
      }),
    };

    await new CompraRevisadoPor20261111010000().up(queryRunner as never);
    expect(queries.some((sql) => /RevisadoPorId/s.test(sql))).toBe(true);
    expect(queries.some((sql) => /RevisadoPorNombre/s.test(sql))).toBe(true);
    expect(queries.some((sql) => /RevisadoPorCorreo/s.test(sql))).toBe(true);

    queries.length = 0;
    await new CompraRevisadoPor20261111010000().down(queryRunner as never);
    expect(queries.some((sql) => /DROP COLUMN IF EXISTS "RevisadoPorId"/s.test(sql))).toBe(
      true,
    );
  });
});
