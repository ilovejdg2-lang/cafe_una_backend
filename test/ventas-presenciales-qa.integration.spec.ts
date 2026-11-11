import { DataSource } from 'typeorm';
import { entities } from '../src/entities';
import { InventarioStockUbicacion } from '../src/entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../src/entities/inventario-ubicacion.entity';
import { Producto } from '../src/entities/producto.entity';
import { Usuario } from '../src/entities/usuario.entity';
import { VendedorPuntoVenta } from '../src/entities/vendedor-punto-venta.entity';
import { Compra } from '../src/entities/compra.entity';
import { CompraItem } from '../src/entities/compra-item.entity';
import { Factura } from '../src/entities/factura.entity';
import { FacturaItem } from '../src/entities/factura-item.entity';
import { Pago } from '../src/entities/pago.entity';
import { MovimientoInventario } from '../src/entities/movimiento-inventario.entity';
import { AsignacionesPuntoVentaService } from '../src/services/asignaciones-punto-venta.service';
import { VentasPresencialesService } from '../src/services/ventas-presenciales.service';

const describeIntegration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const RUN = `QA_CAFEUNA_${Date.now()}`;

describeIntegration('ventas presenciales contra PostgreSQL aislado', () => {
  jest.setTimeout(180000);
  let dataSource: DataSource;
  let service: VentasPresencialesService;
  let vendedorId = 0;
  let otroVendedorId = 0;
  let puntoId = 0;
  let puntoAjenoId = 0;
  let productoId = '';
  let productoAgotadoId = '';
  let productoInactivoId = '';
  const compraIds: number[] = [];
  const nombresProducto: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: process.env.TEST_DATABASE_URL,
      entities,
      synchronize: true,
      ssl: false,
    });
    await dataSource.initialize();

    const asignaciones = new AsignacionesPuntoVentaService(
      dataSource.getRepository(VendedorPuntoVenta),
      dataSource.getRepository(InventarioUbicacion),
      dataSource.getRepository(Usuario),
    );
    service = new VentasPresencialesService(
      dataSource,
      { enviarComprobanteVentaFisica: async () => false } as never,
      asignaciones,
    );

    const vendedor = await dataSource.getRepository(Usuario).save({
      Nombre: `${RUN}_vendedor`,
      Correo: `${RUN}_vendedor@qa.local`,
      PasswordHash: 'no-login',
      Estado: 'activo',
      Roles: ['Vendedor'],
    });
    const otro = await dataSource.getRepository(Usuario).save({
      Nombre: `${RUN}_otro`,
      Correo: `${RUN}_otro@qa.local`,
      PasswordHash: 'no-login',
      Estado: 'activo',
      Roles: ['Vendedor'],
    });
    vendedorId = vendedor.Id;
    otroVendedorId = otro.Id;

    const punto = await dataSource.getRepository(InventarioUbicacion).save({
      Codigo: `POS_${RUN}`.slice(0, 50),
      Nombre: `${RUN} punto`,
      Activo: true,
    });
    const ajeno = await dataSource.getRepository(InventarioUbicacion).save({
      Codigo: `POS_${RUN}_B`.slice(0, 50),
      Nombre: `${RUN} punto b`,
      Activo: true,
    });
    puntoId = punto.Id;
    puntoAjenoId = ajeno.Id;

    await dataSource.getRepository(VendedorPuntoVenta).save({
      VendedorId: vendedorId,
      UbicacionId: puntoId,
      Activo: true,
      CreadoEn: new Date(),
      ActualizadoEn: new Date(),
      AsignadoPorId: null,
    });

    const base = {
      Descripcion: 'Producto temporal de auditoría',
      Imagen: '',
      PrecioNormal: '1000.00',
      PrecioConIVA: '1130.00',
      Estado: 'Habilitado',
      Peso: '250 g',
      Categoria: `${RUN}_cat`,
      Subcategoria: '',
      EsDestacado: false,
      StockMinimo: 0,
      AlertaStock: false,
      Disponible: true,
    };
    const disponible = await dataSource.getRepository(Producto).save({
      ...base,
      Nombre: `${RUN}_cafe`,
      Stock: 4,
    });
    const agotado = await dataSource.getRepository(Producto).save({
      ...base,
      Nombre: `${RUN}_agotado`,
      Stock: 0,
      Disponible: false,
    });
    const inactivo = await dataSource.getRepository(Producto).save({
      ...base,
      Nombre: `${RUN}_inactivo`,
      Stock: 3,
      Estado: 'Deshabilitado',
    });
    productoId = String(disponible.Id);
    productoAgotadoId = String(agotado.Id);
    productoInactivoId = String(inactivo.Id);
    nombresProducto.push(disponible.Nombre, agotado.Nombre, inactivo.Nombre);

    await dataSource.getRepository(InventarioStockUbicacion).save([
      { ProductoId: productoId, UbicacionId: puntoId, Stock: 4, StockReservado: 1 },
      { ProductoId: productoAgotadoId, UbicacionId: puntoId, Stock: 0, StockReservado: 0 },
      { ProductoId: productoInactivoId, UbicacionId: puntoId, Stock: 3, StockReservado: 0 },
    ]);
  });

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;
    const manager = dataSource.manager;
    if (compraIds.length) {
      const facturas = await manager
        .getRepository(Factura)
        .createQueryBuilder('factura')
        .select('factura.Id', 'id')
        .where('factura.CompraId IN (:...ids)', { ids: compraIds })
        .getRawMany<{ id: string }>();
      const facturaIds = facturas.map((fila) => fila.id).filter(Boolean);
      await manager
        .createQueryBuilder()
        .delete()
        .from(Pago)
        .where('"CompraId" IN (:...ids)', { ids: compraIds })
        .execute();
      if (facturaIds.length) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(FacturaItem)
          .where('"FacturaId" IN (:...ids)', { ids: facturaIds })
          .execute();
        await manager
          .createQueryBuilder()
          .delete()
          .from(Factura)
          .where('"Id" IN (:...ids)', { ids: facturaIds })
          .execute();
      }
      await manager
        .createQueryBuilder()
        .delete()
        .from(CompraItem)
        .where('"CompraId" IN (:...ids)', { ids: compraIds })
        .execute();
      await manager
        .createQueryBuilder()
        .delete()
        .from(Compra)
        .where('"Id" IN (:...ids)', { ids: compraIds })
        .execute();
    }
    const productoIds = [productoId, productoAgotadoId, productoInactivoId].filter(Boolean);
    if (productoIds.length) {
      await manager
        .createQueryBuilder()
        .delete()
        .from(MovimientoInventario)
        .where('"ProductoId" IN (:...ids)', { ids: productoIds })
        .execute();
      await manager
        .createQueryBuilder()
        .delete()
        .from(InventarioStockUbicacion)
        .where('"ProductoId" IN (:...ids)', { ids: productoIds })
        .execute();
      await manager
        .createQueryBuilder()
        .delete()
        .from(Producto)
        .where('"Id" IN (:...ids)', { ids: productoIds })
        .execute();
    }
    await manager
      .createQueryBuilder()
      .delete()
      .from(VendedorPuntoVenta)
      .where('"VendedorId" IN (:...ids)', { ids: [vendedorId, otroVendedorId] })
      .execute();
    if (puntoId || puntoAjenoId) {
      await manager
        .createQueryBuilder()
        .delete()
        .from(InventarioUbicacion)
        .where('"Id" IN (:...ids)', { ids: [puntoId, puntoAjenoId].filter(Boolean) })
        .execute();
    }
    await manager
      .createQueryBuilder()
      .delete()
      .from(Usuario)
      .where('"Id" IN (:...ids)', { ids: [vendedorId, otroVendedorId] })
      .execute();

    const restos = await manager.query(
      `SELECT COUNT(*)::int AS total FROM productos WHERE "Nombre" = ANY($1)`,
      [nombresProducto],
    );
    if (Number(restos[0]?.total) !== 0) {
      throw new Error(`Quedaron productos QA: ${JSON.stringify(restos)}`);
    }
    await dataSource.destroy();
  });

  async function stockDe(id: string): Promise<number> {
    const fila = await dataSource.getRepository(InventarioStockUbicacion).findOne({
      where: { ProductoId: id, UbicacionId: puntoId },
    });
    return Number(fila?.Stock ?? -1);
  }

  it('rechaza el ítem con id inválido antes de confirmar y no deja la venta a medias', async () => {
    const antes = await stockDe(productoId);
    await expect(
      service.registrar(
        {
          ubicacionId: puntoId,
          items: [
            { productoId, cantidad: 1, precioUnitario: 1130 },
            { productoId: 'abc', cantidad: 1 },
          ],
        },
        vendedorId,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/identificador válido/);
    expect(await stockDe(productoId)).toBe(antes);
    const compras = await dataSource.getRepository(Compra).count({
      where: { ClienteNombre: `${RUN}_cliente` },
    });
    expect(compras).toBe(0);
  });

  it('registra la venta y deja el precio histórico aunque el catálogo cambie después', async () => {
    const venta = await service.registrar(
      {
        ubicacionId: puntoId,
        clienteNombre: `${RUN}_cliente`,
        metodoPago: 'Efectivo',
        items: [{ productoId, cantidad: 1, precioUnitario: 1130 }],
      },
      vendedorId,
      ['Vendedor'],
    );
    expect(venta.compraId).toBeGreaterThan(0);
    expect(venta.total).toBe(1130);
    expect(venta.responsableId).toBe(vendedorId);
    compraIds.push(Number(venta.compraId));
    expect(await stockDe(productoId)).toBe(3);

    await dataSource.getRepository(Producto).update(productoId, {
      Nombre: `${RUN}_cafe_renombrado`,
    });
    nombresProducto.push(`${RUN}_cafe_renombrado`);
    const item = await dataSource.getRepository(CompraItem).findOne({
      where: { CompraId: Number(venta.compraId) },
    });
    expect(item?.Nombre).toBe(`${RUN}_cafe`);
    expect(Number(item?.PrecioUnitario)).toBe(1130);
    const compra = await dataSource.getRepository(Compra).findOne({
      where: { Id: Number(venta.compraId) },
    });
    expect(compra?.UbicacionId).toBe(puntoId);
    expect(compra?.UsuarioId).toBe(vendedorId);
    expect(compra?.Estado).toBe('Enviado');
    expect(compra?.FacturaId).toMatch(/^FAC-VP-/);
    const pago = await dataSource.getRepository(Pago).findOne({
      where: { CompraId: Number(venta.compraId) },
    });
    expect(pago?.Estado).toBe('Pagado');
    expect(Number(pago?.Monto)).toBe(1130);
    const factura = await dataSource.getRepository(Factura).findOne({
      where: { Id: String(compra?.FacturaId) },
    });
    expect(Number(factura?.Total)).toBe(1130);
    expect(factura?.CompraId).toBe(Number(venta.compraId));
  });

  it('rechaza precio alterado, stock de más, agotado, inactivo, cero, punto ajeno e inactivo', async () => {
    const antes = await stockDe(productoId);
    await expect(
      service.registrar(
        { ubicacionId: puntoId, items: [{ productoId, cantidad: 1, precioUnitario: 1 }] },
        vendedorId,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/no coincide con el catálogo/);
    await expect(
      service.registrar(
        { ubicacionId: puntoId, items: [{ productoId, cantidad: 99, precioUnitario: 1130 }] },
        vendedorId,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/Stock insuficiente/);
    await expect(
      service.registrar(
        {
          ubicacionId: puntoId,
          items: [{ productoId: productoAgotadoId, cantidad: 1, precioUnitario: 1130 }],
        },
        vendedorId,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/Stock insuficiente/);
    await expect(
      service.registrar(
        { ubicacionId: puntoId, items: [{ productoId: productoInactivoId, cantidad: 1 }] },
        vendedorId,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/deshabilitado/);
    await expect(
      service.registrar(
        { ubicacionId: puntoId, items: [{ productoId, cantidad: 0, precioUnitario: 1130 }] },
        vendedorId,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/entero positivo/);
    await expect(
      service.registrar({ ubicacionId: puntoId, items: [] }, vendedorId, ['Vendedor']),
    ).rejects.toThrow(/obligatorio/);
    await expect(
      service.registrar(
        { ubicacionId: puntoAjenoId, items: [{ productoId, cantidad: 1, precioUnitario: 1130 }] },
        vendedorId,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/asignación activa/);
    await dataSource.getRepository(InventarioUbicacion).update(puntoId, { Activo: false });
    await expect(
      service.registrar(
        { ubicacionId: puntoId, items: [{ productoId, cantidad: 1, precioUnitario: 1130 }] },
        vendedorId,
        ['Admin'],
      ),
    ).rejects.toThrow(/inactivo/);
    await dataSource.getRepository(InventarioUbicacion).update(puntoId, { Activo: true });
    expect(await stockDe(productoId)).toBe(antes);
    expect(compraIds).toHaveLength(1);
  });

  it('la segunda confirmación no vuelve a descontar la misma unidad', async () => {
    await dataSource.getRepository(InventarioStockUbicacion).update(
      { ProductoId: productoId, UbicacionId: puntoId },
      { Stock: 1, StockReservado: 0 },
    );
    const primera = await service.registrar(
      { ubicacionId: puntoId, items: [{ productoId, cantidad: 1, precioUnitario: 1130 }] },
      vendedorId,
      ['Vendedor'],
    );
    compraIds.push(Number(primera.compraId));
    await expect(
      service.registrar(
        { ubicacionId: puntoId, items: [{ productoId, cantidad: 1, precioUnitario: 1130 }] },
        vendedorId,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/Stock insuficiente/);
    expect(await stockDe(productoId)).toBe(0);
  });

  it('dos ventas concurrentes sobre la última unidad dejan una sola compra', async () => {
    await dataSource.getRepository(InventarioStockUbicacion).update(
      { ProductoId: productoId, UbicacionId: puntoId },
      { Stock: 1, StockReservado: 0 },
    );
    const resultados = await Promise.allSettled([
      service.registrar(
        { ubicacionId: puntoId, clienteNombre: `${RUN}_conc_a`, items: [{ productoId, cantidad: 1, precioUnitario: 1130 }] },
        vendedorId,
        ['Vendedor'],
      ),
      service.registrar(
        { ubicacionId: puntoId, clienteNombre: `${RUN}_conc_b`, items: [{ productoId, cantidad: 1, precioUnitario: 1130 }] },
        vendedorId,
        ['Vendedor'],
      ),
    ]);
    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const mal = resultados.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(mal).toHaveLength(1);
    const venta = (ok[0] as PromiseFulfilledResult<{ compraId?: number }>).value;
    compraIds.push(Number(venta.compraId));
    expect(await stockDe(productoId)).toBe(0);
    const ajenas = await dataSource.getRepository(Compra).count({
      where: { UsuarioId: otroVendedorId },
    });
    expect(ajenas).toBe(0);
  });

  it('un vendedor sin asignación no opera y el admin sí puede en el punto', async () => {
    await dataSource.getRepository(InventarioStockUbicacion).update(
      { ProductoId: productoId, UbicacionId: puntoId },
      { Stock: 2, StockReservado: 0 },
    );
    await expect(
      service.registrar(
        { ubicacionId: puntoId, items: [{ productoId, cantidad: 1, precioUnitario: 1130 }] },
        otroVendedorId,
        ['Vendedor'],
      ),
    ).rejects.toThrow(/asignación activa/);
    const venta = await service.registrar(
      { ubicacionId: puntoId, items: [{ productoId, cantidad: 1, precioUnitario: 1130 }] },
      otroVendedorId,
      ['Admin'],
    );
    compraIds.push(Number(venta.compraId));
    expect(venta.responsableId).toBe(otroVendedorId);
    expect(await stockDe(productoId)).toBe(1);
  });
});
