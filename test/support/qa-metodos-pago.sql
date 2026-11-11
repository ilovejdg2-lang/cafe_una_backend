CREATE TABLE IF NOT EXISTS catalogo_sistema (
  "Id" serial PRIMARY KEY,
  "Tipo" varchar(40) NOT NULL,
  "Nombre" varchar(120) NOT NULL,
  "Icono" varchar(60) NOT NULL DEFAULT '',
  "Orden" integer NOT NULL DEFAULT 0,
  "Activo" boolean NOT NULL DEFAULT true
);

INSERT INTO catalogo_sistema ("Tipo", "Nombre", "Orden")
SELECT 'metodo_pago', 'Efectivo', 1
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo_sistema WHERE "Tipo" = 'metodo_pago' AND "Nombre" = 'Efectivo'
);
INSERT INTO catalogo_sistema ("Tipo", "Nombre", "Orden")
SELECT 'metodo_pago', 'SINPE Móvil', 2
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo_sistema WHERE "Tipo" = 'metodo_pago' AND "Nombre" = 'SINPE Móvil'
);
INSERT INTO catalogo_sistema ("Tipo", "Nombre", "Orden")
SELECT 'metodo_pago', 'Transferencia', 3
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo_sistema WHERE "Tipo" = 'metodo_pago' AND "Nombre" = 'Transferencia'
);
