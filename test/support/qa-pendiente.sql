INSERT INTO compras (
  "Numero","UsuarioId","ClienteNombre","ClienteCorreo","Fecha",
  "Subtotal","Impuestos","Total","MetodoPago","Estado","ComprobanteArchivo","UbicacionId"
) VALUES (
  'WEB-QA_CAFEUNA_1794418501371', 5,
  'QA_CAFEUNA_1794418501371_cliente_web',
  'QA_CAFEUNA_1794418501371_cliente@qa.local',
  NOW(), '1130.00', '0.00', '1130.00', 'SINPE', 'Pendiente',
  'qa-comprobante.jpg', 3
) RETURNING "Id";
