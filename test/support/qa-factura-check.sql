SELECT c."Id", c."Numero", c."Total", c."FacturaId", c."Estado", c."MetodoPago",
       f."Total" AS factura_total, f."Estado" AS factura_estado,
       p."Monto" AS pago_monto, p."Estado" AS pago_estado, p."Metodo" AS pago_metodo
FROM compras c
LEFT JOIN facturas f ON f."Id" = c."FacturaId"
LEFT JOIN pagos p ON p."CompraId" = c."Id"
WHERE c."Numero" = 'VP-20261111-1814';
