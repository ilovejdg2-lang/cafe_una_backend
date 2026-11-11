SELECT c."Id", c."Numero", c."Estado", c."FacturaId",
       (SELECT COUNT(*) FROM facturas f WHERE f."CompraId" = c."Id") AS facturas
FROM compras c
WHERE c."Id" IN (5, 6)
ORDER BY c."Id";
