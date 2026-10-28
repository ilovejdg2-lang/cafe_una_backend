import { calcularStockDisponible } from './inventario-stock.util';

describe('calcularStockDisponible', () => {
  it('subtracts pending reservations from physical stock', () => {
    expect(calcularStockDisponible(8, 4)).toBe(4);
  });
});
