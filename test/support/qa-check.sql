SELECT "Stock", "StockReservado"
FROM inventario_stock_ubicaciones
WHERE "ProductoId" = '4' AND "UbicacionId" = 3;

SELECT "Id", "Numero", "Total", "ClienteNombre", "UsuarioId", "UbicacionId", "Estado", "FacturaId", "MetodoPago"
FROM compras
WHERE "Numero" = 'VP-20261111-7809';

SELECT i."Nombre", i."Cantidad", i."PrecioUnitario", i."Subtotal"
FROM compra_items i
JOIN compras c ON c."Id" = i."CompraId"
WHERE c."Numero" = 'VP-20261111-7809';

SELECT COUNT(*) AS facturas
FROM facturas f
JOIN compras c ON c."Id" = f."CompraId"
WHERE c."Numero" = 'VP-20261111-7809';

SELECT COUNT(*) AS pagos
FROM pagos p
JOIN compras c ON c."Id" = p."CompraId"
WHERE c."Numero" = 'VP-20261111-7809';
