import { QueryRunner } from 'typeorm';
import {
  DocumentosAudienciaCategorias20261109010000,
  SQL_UP_AUDIENCIA_CATEGORIAS,
} from './20261109010000-documentos-audiencia-categorias';

function crearRunner(
  existe: { tablas?: string[]; columnas?: string[] } = {},
) {
  const tablas = existe.tablas ?? ['categorias', 'documentos'];
  const query = jest.fn().mockResolvedValue(undefined);
  const hasTable = jest.fn((t: string) => Promise.resolve(tablas.includes(t)));
  const hasColumn = jest.fn((t: string, c: string) =>
    Promise.resolve(
      existe.columnas ? existe.columnas.includes(`${t}.${c}`) : true,
    ),
  );
  return {
    query,
    runner: { query, hasTable, hasColumn } as unknown as QueryRunner,
  };
}

describe('DocumentosAudienciaCategorias20261109010000', () => {
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map(([sql]) => String(sql));

  it('usa un nombre cuyo sufijo de 13 dígitos TypeORM puede interpretar', () => {
    const migracion = new DocumentosAudienciaCategorias20261109010000();
    expect(migracion.name).toBe('DocumentosAudienciaCategorias20261109010000');
    expect(Number.isInteger(parseInt(migracion.name.slice(-13), 10))).toBe(true);
  });

  it('up reclasifica, inserta y privatiza de forma idempotente', async () => {
    const { query, runner } = crearRunner();
    await new DocumentosAudienciaCategorias20261109010000().up(runner);

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
    const { query, runner } = crearRunner();
    await new DocumentosAudienciaCategorias20261109010000().down(runner);

    const todo = sqlOf(query).join('\n');
    expect(todo).toMatch(/SET "Tipo" = 'documento'[\s\S]+WHERE c\."Tipo" = 'documento_admin'/);
    expect(todo).toMatch(/DELETE FROM categorias/);
    expect(todo).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM documentos/);
    expect(todo).not.toMatch(/EsPrivado/);
  });

  it('no ejecuta nada si las tablas no existen (BD nueva)', async () => {
    const { query, runner } = crearRunner({ tablas: [] });
    const migracion = new DocumentosAudienciaCategorias20261109010000();
    await migracion.up(runner);
    await migracion.down(runner);
    expect(query).not.toHaveBeenCalled();
  });

  it('omite los pasos cuyas columnas faltan', async () => {
    const { query, runner } = crearRunner({
      columnas: [
        'categorias.Nombre',
        'categorias.Tipo',
        'categorias.Padre',
        'categorias.Descripcion',
      ],
    });
    await new DocumentosAudienciaCategorias20261109010000().up(runner);
    const sentencias = sqlOf(query);
    expect(sentencias).toEqual(SQL_UP_AUDIENCIA_CATEGORIAS.slice(0, 2));
  });

  it('compara los nombres con TRIM en ambos lados', () => {
    const todo = SQL_UP_AUDIENCIA_CATEGORIAS.join(' ');
    expect(todo).toContain('LOWER(TRIM(c."Nombre")) IN');
    expect(todo).toContain('LOWER(TRIM(c."Nombre")) = LOWER(TRIM(d."Categoria"))');
    expect(todo).toContain('LOWER(TRIM(c."Padre")) = LOWER(TRIM(d."Categoria"))');
  });
});
