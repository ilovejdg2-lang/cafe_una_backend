import bcrypt from 'bcrypt';
import pg from 'pg';
import { writeFileSync } from 'node:fs';

const url = process.env.TEST_DATABASE_URL;
if (!url || !url.includes('127.0.0.1') && !url.includes('localhost')) {
  console.error('TEST_DATABASE_URL debe apuntar a localhost');
  process.exit(1);
}
const password = process.env.QA_PASSWORD;
if (!password) {
  console.error('QA_PASSWORD requerido');
  process.exit(1);
}

const run = `QA_CAFEUNA_${Date.now()}`;
const client = new pg.Client({ connectionString: url });
await client.connect();
const hash = await bcrypt.hash(password, 12);

async function usuario(suffix, rol) {
  const row = await client.query(
    `INSERT INTO usuarios ("Nombre","Correo","PasswordHash","Estado","Roles")
     VALUES ($1,$2,$3,'activo',$4) RETURNING "Id"`,
    [`${run}_${suffix}`, `${run}_${suffix}@qa.local`, hash, JSON.stringify([rol])],
  );
  return row.rows[0].Id;
}

const superId = await usuario('super', 'SuperAdmin');
const adminId = await usuario('admin', 'Admin');
const vendedorId = await usuario('vendedor', 'Vendedor');
const clienteId = await usuario('cliente', 'Cliente');

const punto = await client.query(
  `INSERT INTO inventario_ubicaciones ("Codigo","Nombre","Activo")
   VALUES ($1,$2,true) RETURNING "Id","Codigo"`,
  [`POS_${run}`.slice(0, 50), `${run} punto`],
);
const puntoId = punto.rows[0].Id;
const puntoCodigo = punto.rows[0].Codigo;

await client.query(
  `INSERT INTO vendedor_punto_venta
     ("VendedorId","UbicacionId","Activo","CreadoEn","ActualizadoEn")
   VALUES ($1,$2,true,NOW(),NOW())`,
  [vendedorId, puntoId],
);

const base = {
  descripcion: 'Producto temporal de auditoría local',
  imagen: '',
  precioNormal: '1000.00',
  precioIva: '1130.00',
  peso: '250 g',
  categoria: `${run}_cat`,
};
async function producto(suffix, estado, stock) {
  const row = await client.query(
    `INSERT INTO productos (
      "Nombre","Descripcion","NombreEn","DescripcionEn","Imagen",
      "PrecioNormal","PrecioConIVA","Stock","Estado","Peso",
      "Categoria","Subcategoria","EsDestacado","StockMinimo","AlertaStock","Disponible"
    ) VALUES (
      $1,$2,'','',$3,$4,$5,$6,$7,$8,$9,'',false,0,false,$10
    ) RETURNING "Id","Nombre"`,
    [
      `${run}_${suffix}`,
      base.descripcion,
      base.imagen,
      base.precioNormal,
      base.precioIva,
      stock,
      estado,
      base.peso,
      base.categoria,
      stock > 0,
    ],
  );
  return row.rows[0];
}

const cafe = await producto('cafe', 'Habilitado', 8);
const agotado = await producto('agotado', 'Habilitado', 0);
await client.query(
  `INSERT INTO inventario_stock_ubicaciones ("ProductoId","UbicacionId","Stock","StockReservado")
   VALUES ($1,$2,8,0), ($3,$2,0,0)`,
  [String(cafe.Id), puntoId, String(agotado.Id)],
);

const evidencia = {
  run,
  superId,
  adminId,
  vendedorId,
  clienteId,
  puntoId,
  puntoCodigo,
  productoIds: [String(cafe.Id), String(agotado.Id)],
  correos: {
    super: `${run}_super@qa.local`,
    admin: `${run}_admin@qa.local`,
    vendedor: `${run}_vendedor@qa.local`,
    cliente: `${run}_cliente@qa.local`,
  },
};
writeFileSync(new URL('./qa-browser-run.json', import.meta.url), JSON.stringify(evidencia, null, 2));
console.log(JSON.stringify({ run, puntoCodigo, productoId: String(cafe.Id) }));
await client.end();
