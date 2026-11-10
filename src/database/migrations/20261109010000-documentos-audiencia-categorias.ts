import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Separa las categorías del repositorio documental por audiencia:
 *  - 'documento': categorías públicas.
 *  - 'documento_admin': categorías administrativas (sus documentos son siempre privados).
 *
 * Es idempotente: se puede ejecutar más de una vez sin duplicar ni alterar datos ya migrados.
 */

/** Nombres (en minúsculas) de las categorías raíz administrativas. */
const NOMBRES_ADMIN = [
  'minutas',
  'informes institucionales',
  'documento vision',
  'documento visión',
  'normativa y reglamentos',
];
const LISTA_ADMIN = NOMBRES_ADMIN.map((n) => `'${n}'`).join(', ');

/** Categorías públicas que deben existir. La descripción identifica las filas creadas por esta migración. */
const CATEGORIAS_PUBLICAS = [
  ['Cosechas', 'Informes y registros de cosechas del café'],
  ['Cultivo y manejo', 'Prácticas de cultivo y manejo del cafetal'],
  ['Historia del café', 'Historia y tradición del café'],
  ['Tesis', 'Tesis y trabajos de grado sobre el café'],
  ['Noticias', 'Noticias y novedades del sector cafetalero'],
];
const VALORES_PUBLICAS = CATEGORIAS_PUBLICAS.map(
  ([nombre, descripcion]) => `('${nombre}', '${descripcion}')`,
).join(',\n          ');
const NOMBRES_PUBLICAS = CATEGORIAS_PUBLICAS.map(([n]) => `'${n}'`).join(', ');
const DESCRIPCIONES_PUBLICAS = CATEGORIAS_PUBLICAS.map(
  ([, d]) => `'${d}'`,
).join(', ');

export const SQL_UP_AUDIENCIA_CATEGORIAS: string[] = [
  // 1. Reclasifica las categorías administrativas (y sus subcategorías, p. ej. PRUEBA bajo MINUTAS).
  `UPDATE categorias c
      SET "Tipo" = 'documento_admin'
    WHERE c."Tipo" = 'documento'
      AND (
        (TRIM(COALESCE(c."Padre", '')) = '' AND LOWER(TRIM(c."Nombre")) IN (${LISTA_ADMIN}))
        OR LOWER(TRIM(c."Padre")) IN (${LISTA_ADMIN})
      )
      AND NOT EXISTS (
        SELECT 1 FROM categorias x
         WHERE x."Tipo" = 'documento_admin'
           AND x."Nombre" = c."Nombre"
           AND COALESCE(x."Padre", '') = COALESCE(c."Padre", '')
      )`,

  // 2. Inserta las categorías públicas que falten.
  `INSERT INTO categorias ("Nombre", "Descripcion", "Tipo", "Padre")
      SELECT v.nombre, v.descripcion, 'documento', ''
        FROM (VALUES
          ${VALORES_PUBLICAS}
        ) AS v(nombre, descripcion)
       WHERE NOT EXISTS (
         SELECT 1 FROM categorias c
          WHERE c."Tipo" = 'documento'
            AND LOWER(TRIM(c."Nombre")) = LOWER(TRIM(v.nombre))
            AND TRIM(COALESCE(c."Padre", '')) = ''
       )
      ON CONFLICT DO NOTHING`,

  // 3. Todo documento (activo o no) de una categoría administrativa pasa a privado.
  `UPDATE documentos d
      SET "EsPrivado" = true
    WHERE d."EsPrivado" = false
      AND EXISTS (
        SELECT 1 FROM categorias c
         WHERE c."Tipo" = 'documento_admin'
           AND (
             (LOWER(TRIM(c."Nombre")) = LOWER(TRIM(d."Categoria")) AND TRIM(COALESCE(c."Padre", '')) = '')
             OR (LOWER(TRIM(c."Nombre")) = LOWER(TRIM(d."Subcategoria")) AND TRIM(COALESCE(c."Padre", '')) = '')
             OR (LOWER(TRIM(c."Nombre")) = LOWER(TRIM(d."Subcategoria")) AND LOWER(TRIM(c."Padre")) = LOWER(TRIM(d."Categoria")))
           )
      )`,
];

export class DocumentosAudienciaCategorias20261109010000
  implements MigrationInterface
{
  name = 'DocumentosAudienciaCategorias20261109010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Una BD nueva que nunca arrancó la app puede no tener aún estas tablas.
    if (!(await this.categoriasListas(queryRunner))) return;
    const [reclasificar, insertar, privatizar] = SQL_UP_AUDIENCIA_CATEGORIAS;
    await queryRunner.query(reclasificar);
    await queryRunner.query(insertar);
    if (await this.documentosListos(queryRunner)) {
      await queryRunner.query(privatizar);
    }
  }

  private async categoriasListas(queryRunner: QueryRunner): Promise<boolean> {
    if (!(await queryRunner.hasTable('categorias'))) return false;
    for (const columna of ['Nombre', 'Tipo', 'Padre', 'Descripcion']) {
      if (!(await queryRunner.hasColumn('categorias', columna))) return false;
    }
    return true;
  }

  private async documentosListos(queryRunner: QueryRunner): Promise<boolean> {
    if (!(await queryRunner.hasTable('documentos'))) return false;
    for (const columna of ['Categoria', 'Subcategoria', 'EsPrivado']) {
      if (!(await queryRunner.hasColumn('documentos', columna))) return false;
    }
    return true;
  }

  /**
   * Revierte el tipo de las categorías y elimina solo las categorías públicas
   * insertadas por esta migración (identificadas por su descripción) que no
   * tengan documentos. NO restaura "EsPrivado": los documentos que se
   * privatizaron en `up` permanecen privados.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.categoriasListas(queryRunner))) return;
    await queryRunner.query(`
      UPDATE categorias c
         SET "Tipo" = 'documento'
       WHERE c."Tipo" = 'documento_admin'
         AND NOT EXISTS (
           SELECT 1 FROM categorias x
            WHERE x."Tipo" = 'documento'
              AND x."Nombre" = c."Nombre"
              AND COALESCE(x."Padre", '') = COALESCE(c."Padre", '')
         )
    `);
    if (!(await this.documentosListos(queryRunner))) return;
    await queryRunner.query(`
      DELETE FROM categorias c
       WHERE c."Tipo" = 'documento'
         AND COALESCE(c."Padre", '') = ''
         AND c."Nombre" IN (${NOMBRES_PUBLICAS})
         AND c."Descripcion" IN (${DESCRIPCIONES_PUBLICAS})
         AND NOT EXISTS (
           SELECT 1 FROM documentos d
            WHERE LOWER(d."Categoria") = LOWER(c."Nombre")
               OR LOWER(d."Subcategoria") = LOWER(c."Nombre")
         )
    `);
  }
}
