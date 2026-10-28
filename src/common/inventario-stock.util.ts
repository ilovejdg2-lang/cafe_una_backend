export function calcularStockDisponible(
  stockFisico: unknown,
  stockReservado: unknown = 0,
): number {
  const stock = Number(stockFisico);
  const reservado = Number(stockReservado);
  const fisicoValido = Number.isFinite(stock) ? stock : 0;
  const reservadoValido = Number.isFinite(reservado) ? reservado : 0;
  return Math.max(0, fisicoValido - reservadoValido);
}
