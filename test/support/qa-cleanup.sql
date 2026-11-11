-- Limpieza por identificadores exactos de la corrida QA_CAFEUNA_1794415045981.
-- Solo la base local cafe_una_qa. Aborta si el punto o los correos no coinciden.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM inventario_ubicaciones
    WHERE "Id" = 3 AND "Codigo" = 'POS_QA_CAFEUNA_1794415045981'
  ) THEN
    RAISE EXCEPTION 'punto QA no coincide; no se borra nada';
  END IF;
  IF (
    SELECT COUNT(*) FROM usuarios
    WHERE "Id" IN (3, 4, 5, 6)
      AND "Correo" LIKE 'QA_CAFEUNA_1794415045981%@qa.local'
  ) <> 4 THEN
    RAISE EXCEPTION 'usuarios QA no coinciden; no se borra nada';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM productos
    WHERE "Id" IN ('4', '5') AND "Nombre" LIKE 'QA_CAFEUNA_1794415045981%'
  ) THEN
    RAISE EXCEPTION 'productos QA no coinciden; no se borra nada';
  END IF;
END $$;

DELETE FROM notificaciones WHERE "UsuarioId" IN (3, 4, 5, 6);
DELETE FROM auditoria WHERE "IdUsuario" IN (3, 4, 5, 6);
DELETE FROM carrito_items WHERE "UsuarioId" IN (3, 4, 5, 6);
DELETE FROM clientes WHERE "UsuarioId" IN (3, 4, 5, 6);
DELETE FROM clientes_juridicos WHERE "UsuarioId" IN (3, 4, 5, 6);
DELETE FROM cambios_correo_pendientes WHERE "UsuarioId" IN (3, 4, 5, 6);
DELETE FROM factura_items
WHERE "FacturaId" IN (
  SELECT "Id" FROM facturas
  WHERE "CompraId" = 5 OR "UsuarioId" IN (3, 4, 5, 6)
);
DELETE FROM facturas WHERE "CompraId" = 5 OR "UsuarioId" IN (3, 4, 5, 6);
DELETE FROM pagos WHERE "CompraId" = 5;
DELETE FROM compra_items WHERE "CompraId" = 5 OR "ProductoId" IN ('4', '5');
DELETE FROM movimientos_inventario
WHERE "ProductoId" IN ('4', '5')
   OR "UbicacionId" = 3
   OR "UbicacionOrigenId" = 3
   OR "UbicacionDestinoId" = 3
   OR "ResponsableId" IN (3, 4, 5, 6);
DELETE FROM inventario_stock_ubicaciones
WHERE "ProductoId" IN ('4', '5') OR "UbicacionId" = 3;
DELETE FROM vendedor_punto_venta
WHERE "VendedorId" IN (3, 4, 5, 6) OR "UbicacionId" = 3;
DELETE FROM cierres_compra WHERE "UbicacionId" = 3;
DELETE FROM compras
WHERE "Id" = 5
   OR "Numero" = 'VP-20261111-7809'
   OR "UsuarioId" IN (3, 4, 5, 6);
DELETE FROM productos
WHERE "Id" IN ('4', '5') AND "Nombre" LIKE 'QA_CAFEUNA_1794415045981%';
DELETE FROM inventario_ubicaciones
WHERE "Id" = 3 AND "Codigo" = 'POS_QA_CAFEUNA_1794415045981';
DELETE FROM usuarios
WHERE "Id" IN (3, 4, 5, 6)
  AND "Correo" LIKE 'QA_CAFEUNA_1794415045981%@qa.local';

SELECT 'usuarios' AS tabla, COUNT(*) AS restantes
FROM usuarios WHERE "Correo" LIKE 'QA_CAFEUNA_%'
UNION ALL
SELECT 'productos', COUNT(*) FROM productos WHERE "Nombre" LIKE 'QA_CAFEUNA_%'
UNION ALL
SELECT 'puntos', COUNT(*) FROM inventario_ubicaciones WHERE "Codigo" LIKE 'POS_QA_CAFEUNA_%'
UNION ALL
SELECT 'compras', COUNT(*) FROM compras WHERE "ClienteNombre" LIKE 'QA_CAFEUNA_%' OR "Numero" = 'VP-20261111-7809'
UNION ALL
SELECT 'items', COUNT(*) FROM compra_items WHERE "Nombre" LIKE 'QA_CAFEUNA_%'
UNION ALL
SELECT 'stock', COUNT(*) FROM inventario_stock_ubicaciones WHERE "ProductoId" IN ('4', '5') OR "UbicacionId" = 3
UNION ALL
SELECT 'movimientos', COUNT(*) FROM movimientos_inventario WHERE "ProductoId" IN ('4', '5') OR "UbicacionId" = 3;
