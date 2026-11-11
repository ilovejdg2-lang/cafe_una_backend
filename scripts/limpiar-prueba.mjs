import 'dotenv/config';
import pg from 'pg';

/** "prueba" / "pruebas" como palabra; no "aprueba". */
const WORD = String.raw`(^|[^[:alpha:]])pruebas?([^[:alpha:]]|$)`;
const DRY = process.argv.includes('--dry');

const client = new pg.Client({
  host: process.env.SUPABASE_HOST,
  port: Number(process.env.SUPABASE_PORT || 5432),
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  database: process.env.SUPABASE_DB || 'postgres',
  ssl: { rejectUnauthorized: false },
});

const match = (col) => `CAST("${col}" AS text) ~* '${WORD}'`;
const orMatch = (...cols) => cols.map(match).join(' OR ');

async function run(label, sql, params = []) {
  if (DRY) {
    const countSql = sql.replace(/^DELETE FROM/i, 'SELECT COUNT(*)::int AS n FROM').replace(/ RETURNING .*$/i, '');
    // For DELETE ... WHERE, convert to SELECT COUNT
    let previewSql = sql;
    if (/^DELETE FROM/i.test(sql)) {
      previewSql = sql.replace(/^DELETE FROM\s+("[^"]+"|\w+)/i, 'SELECT COUNT(*)::int AS n FROM $1');
    }
    const res = await client.query(previewSql, params);
    const n = res.rows[0]?.n ?? res.rowCount;
    console.log(`DRY ${label}: ${n}`);
    return n;
  }
  const res = await client.query(sql, params);
  console.log(`DEL ${label}: ${res.rowCount}`);
  return res.rowCount;
}

await client.connect();
await client.query('BEGIN');

try {
  // 1. Auditoría
  await run(
    'auditoria',
    `DELETE FROM auditoria WHERE ${orMatch('Detalle', 'DatosAnteriores', 'DatosNuevos', 'Tabla', 'Accion')}`,
  );

  // 2. Documentos / descargas con categoría o título de prueba
  const docs = await client.query(
    `SELECT "Id" FROM documentos WHERE ${orMatch('Titulo', 'Descripcion', 'Categoria', 'Subcategoria', 'PalabrasClave')}`,
  );
  const docIds = docs.rows.map((r) => Number(r.Id));
  if (docIds.length) {
    await run(
      'descargas_documentos(docs)',
      `DELETE FROM descargas_documentos WHERE "DocumentoId" = ANY($1::int[])`,
      [docIds],
    );
    await run(
      'documentos',
      `DELETE FROM documentos WHERE "Id" = ANY($1::int[])`,
      [docIds],
    );
  } else {
    console.log('skip documentos: 0');
  }

  // Categoría PRUEBA
  await run('categorias', `DELETE FROM categorias WHERE ${match('Nombre')}`);

  // 3. Ventas presenciales con ítems "Café de prueba..."
  const ventas = await client.query(
    `SELECT DISTINCT "VentaId" FROM venta_presencial_items WHERE ${match('Nombre')}`,
  );
  const ventaIds = ventas.rows.map((r) => Number(r.VentaId));
  if (ventaIds.length) {
    await run(
      'venta_presencial_items',
      `DELETE FROM venta_presencial_items WHERE "VentaId" = ANY($1::bigint[])`,
      [ventaIds],
    );
    await run(
      'ventas_presenciales',
      `DELETE FROM ventas_presenciales WHERE "Id" = ANY($1::bigint[])`,
      [ventaIds],
    );
  } else {
    console.log('skip ventas_presenciales: 0');
  }

  // 4. Movimientos append-only: bajar triggers, borrar, volver a crearlos
  const movWhere = orMatch('Observaciones', 'Notas');
  if (DRY) {
    const n = (
      await client.query(
        `SELECT COUNT(*)::int AS n FROM movimientos_inventario WHERE ${movWhere}`,
      )
    ).rows[0].n;
    console.log(`DRY movimientos_inventario: ${n}`);
  } else {
    await client.query(
      `ALTER TABLE movimientos_inventario DISABLE TRIGGER trg_movimientos_inventario_no_delete`,
    );
    await client.query(
      `ALTER TABLE movimientos_inventario DISABLE TRIGGER trg_movimientos_inventario_no_update`,
    );
    const mov = await client.query(
      `DELETE FROM movimientos_inventario WHERE ${movWhere}`,
    );
    console.log(`DEL movimientos_inventario: ${mov.rowCount}`);
    await client.query(
      `ALTER TABLE movimientos_inventario ENABLE TRIGGER trg_movimientos_inventario_no_delete`,
    );
    await client.query(
      `ALTER TABLE movimientos_inventario ENABLE TRIGGER trg_movimientos_inventario_no_update`,
    );
  }

  await run('transferencias', `DELETE FROM transferencias WHERE ${match('Notas')}`);

  // 5. Compras / facturas con nombre de ítem de prueba
  const compras = await client.query(
    `SELECT DISTINCT "CompraId" FROM compra_items WHERE ${match('Nombre')}
     UNION
     SELECT "Id" FROM compras WHERE ${orMatch('ClienteNombre', 'ClienteCorreo', 'Numero')}`,
  );
  const compraIds = compras.rows
    .map((r) => Number(r.CompraId ?? r.Id))
    .filter((id) => Number.isFinite(id));
  if (compraIds.length) {
    const facturas = await client.query(
      `SELECT "Id" FROM facturas WHERE "CompraId" = ANY($1::int[])`,
      [compraIds],
    );
    const facturaIds = facturas.rows.map((r) => String(r.Id));
    if (facturaIds.length) {
      await run(
        'factura_items',
        `DELETE FROM factura_items WHERE "FacturaId" = ANY($1::text[])`,
        [facturaIds],
      );
      await run(
        'facturas',
        `DELETE FROM facturas WHERE "Id" = ANY($1::text[])`,
        [facturaIds],
      );
    }
    await run(
      'compra_items',
      `DELETE FROM compra_items WHERE "CompraId" = ANY($1::int[])`,
      [compraIds],
    );
    await run(
      'compras',
      `DELETE FROM compras WHERE "Id" = ANY($1::int[])`,
      [compraIds],
    );
  } else {
    console.log('skip compras: 0');
  }

  // Factura items sueltos por descripción
  await run(
    'factura_items(desc)',
    `DELETE FROM factura_items WHERE ${match('Descripcion')}`,
  );

  // 6. Solicitudes de compra + proveedor QA
  const prov = await client.query(
    `SELECT "Id" FROM proveedores WHERE ${orMatch('Nombre', 'Correo')}`,
  );
  const provIds = prov.rows.map((r) => Number(r.Id));
  await run(
    'solicitudes_compra(notas)',
    `DELETE FROM solicitudes_compra WHERE ${match('Notas')}`,
  );
  if (provIds.length) {
    await run(
      'solicitudes_compra(prov)',
      `DELETE FROM solicitudes_compra WHERE "ProveedorId" = ANY($1::int[])`,
      [provIds],
    );
    await run(
      'proveedores',
      `DELETE FROM proveedores WHERE "Id" = ANY($1::int[])`,
      [provIds],
    );
  }

  // 7. Correos / visitas / descargas residuales
  await run(
    'correos_salida',
    `DELETE FROM correos_salida WHERE ${orMatch('Destinatario', 'Asunto', 'Html', 'Texto', 'UltimoError')}`,
  );
  await run(
    'disponibilidades_visitas',
    `DELETE FROM disponibilidades_visitas WHERE ${match('Nota')}`,
  );
  await run(
    'descargas_documentos(texto)',
    `DELETE FROM descargas_documentos WHERE ${match('UsuarioNombre')}`,
  );

  // 8. No borrar historia_completa (CMS real; puede mencionar "pruebas" académicas)
  const histCols = (
    await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='historia_completa'
         AND data_type IN ('text','character varying','character','json','jsonb','citext')`,
    )
  ).rows.map((r) => r.column_name);
  if (histCols.length) {
    const hist = await client.query(
      `SELECT COUNT(*)::int AS n FROM historia_completa WHERE ${histCols.map(match).join(' OR ')}`,
    );
    console.log(
      `KEEP historia_completa: ${hist.rows[0].n} mención(es) dejadas (contenido CMS)`,
    );
  }

  // Residual
  const tables = (
    await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`)
  ).rows.map((r) => r.table_name);

  const residual = [];
  for (const table of tables) {
    if (table === 'historia_completa') continue;
    const cols = (
      await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1
           AND data_type IN ('text','character varying','character','json','jsonb','citext')`,
        [table],
      )
    ).rows.map((r) => r.column_name);
    if (!cols.length) continue;
    const where = cols.map((c) => match(c)).join(' OR ');
    const n = (
      await client.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE ${where}`)
    ).rows[0].n;
    if (n > 0) residual.push({ table, n });
  }
  console.log('RESIDUAL:', residual);

  if (DRY) {
    await client.query('ROLLBACK');
    console.log('DRY RUN — rollback');
  } else {
    await client.query('COMMIT');
    console.log('COMMIT ok');
  }
} catch (error) {
  try {
    await client.query(
      `ALTER TABLE movimientos_inventario ENABLE TRIGGER trg_movimientos_inventario_no_delete`,
    );
    await client.query(
      `ALTER TABLE movimientos_inventario ENABLE TRIGGER trg_movimientos_inventario_no_update`,
    );
  } catch {
    /* ignore */
  }
  await client.query('ROLLBACK');
  console.error('ROLLBACK:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
