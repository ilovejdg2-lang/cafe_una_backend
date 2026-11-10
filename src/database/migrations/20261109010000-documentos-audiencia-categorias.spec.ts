import { QueryRunner } from 'typeorm';
import {
  DocumentosAudienciaCategorias20261109010000,
  SQL_UP_AUDIENCIA_CATEGORIAS,
} from './20261109010000-documentos-audiencia-categorias';

describe('DocumentosAudienciaCategorias20261109010000', () => {
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map(([sql]) => String(sql));

  it('usa un nombre cuyo sufijo de 13 dígitos TypeORM puede interpretar', () => {
    const migracion = new DocumentosAudienciaCategorias20261109010000();
    expect(migracion.name).toBe('DocumentosAudienciaCategorias20261109010000');
    expect(Number.isInteger(parseInt(migracion.name.slice(-13), 10))).toBe(true);
  });

  it('up reclasifica, inserta y privatiza de forma idempotente', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new DocumentosAudienciaCategorias20261109010000().up({
      query,
    } as unknown as QueryRunner);

    const sentencias = sqlOf(query);
    expect(sentencias).toEqual(SQL_UP_AUDIENCIA_CATEGORIAS);
    const todo = sentencias.join('\n');

    // 1. Reclasificación (incluye PRUEBA como hija de MINUTAS)
    expect(todo).toMatch(/UPDATE categorias[\s\S]+SET "Tipo" = 'documento_admin'/);
    for (const nombre of [
      'minutas',
      'informes institucionales',
      'documento vision',
      'normativa y reglamentos',
    ]) {
      expect(todo).toContain(`'${nombre}'`);
    }
    // 2. Categorías públicas faltantes
    for (const nombre of [
      'Cosechas',
      'Cultivo y manejo',
      'Historia del café',
      'Tesis',
      'Noticias',
    ]) {
      expect(todo).toContain(`'${nombre}'`);
    }
    expect(todo).toMatch(/INSERT INTO categorias[\s\S]+WHERE NOT EXISTS/);
    expect(todo).toMatch(/ON CONFLICT DO NOTHING/);
    // 3. Documentos de categorías administrativas pasan a privados
    expect(todo).toMatch(/UPDATE documentos[\s\S]+SET "EsPrivado" = true/);
    expect(todo).toMatch(/"EsPrivado" = false/);
  });

  it('down revierte el tipo y borra solo las categorías insertadas sin documentos', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new DocumentosAudienciaCategorias20261109010000().down({
      query,
    } as unknown as QueryRunner);

    const todo = sqlOf(query).join('\n');
    expect(todo).toMatch(/SET "Tipo" = 'documento'[\s\S]+WHERE c\."Tipo" = 'documento_admin'/);
    expect(todo).toMatch(/DELETE FROM categorias/);
    expect(todo).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM documentos/);
    expect(todo).not.toMatch(/EsPrivado/);
  });
});
