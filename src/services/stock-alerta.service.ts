import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../common/email.service';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Usuario } from '../entities/usuario.entity';

const BODEGA_CENTRAL = 'BODEGA_CENTRAL';
/** Stand Ferias no entra en alertas de stock mínimo. */
const UBICACIONES_SIN_ALERTA = new Set(['POS_STAND_FERIAS']);

export type UbicacionAlertaStock = {
  codigo: string;
  nombre: string;
  stock: number;
};

export type ProductoAlertaStock = {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  agotado: boolean;
  alertaStock: boolean;
  disponible: boolean;
  ubicaciones: UbicacionAlertaStock[];
};

@Injectable()
export class StockAlertaService {
  private readonly logger = new Logger(StockAlertaService.name);

  constructor(
    @InjectRepository(Producto)
    private readonly productosRepo: Repository<Producto>,
    @InjectRepository(InventarioStockUbicacion)
    private readonly stockRepo: Repository<InventarioStockUbicacion>,
    @InjectRepository(InventarioUbicacion)
    private readonly ubicacionesRepo: Repository<InventarioUbicacion>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly emailService: EmailService,
  ) {}

  async obtenerStockTotal(productId: string, fallbackStock = 0): Promise<number> {
    const row = await this.stockRepo
      .createQueryBuilder('stock')
      .select('COALESCE(SUM(stock.Stock), 0)', 'total')
      .where('stock.ProductoId = :productId', { productId: String(productId) })
      .getRawOne<{ total: string }>();
    const sum = Number(row?.total);
    if (Number.isFinite(sum) && sum >= 0) {
      const count = await this.stockRepo.count({
        where: { ProductoId: String(productId) },
      });
      if (count > 0) return sum;
    }
    return Math.max(0, Number(fallbackStock) || 0);
  }

  /**
   * Alinea Bodega Central con productos.Stock (lo que muestra el editor de stock)
   * cuando quedaron desfasados (p. ej. ventas que solo bajaban la columna Stock).
   */
  private async sincronizarBodegaConProducto(
    producto: Producto,
  ): Promise<number | null> {
    const central = await this.ubicacionesRepo.findOne({
      where: { Codigo: BODEGA_CENTRAL },
    });
    if (!central) return null;

    let balance = await this.stockRepo.findOne({
      where: {
        ProductoId: String(producto.Id),
        UbicacionId: central.Id,
      },
    });

    const stockProducto = Math.max(0, Number(producto.Stock) || 0);
    if (!balance) {
      balance = this.stockRepo.create({
        ProductoId: String(producto.Id),
        UbicacionId: central.Id,
        Stock: stockProducto,
      });
      await this.stockRepo.save(balance);
      return stockProducto;
    }

    if (Number(balance.Stock) !== stockProducto) {
      this.logger.warn(
        `Reconciliando Bodega Central del producto ${producto.Id}: ubicación=${balance.Stock} → productos.Stock=${stockProducto}`,
      );
      balance.Stock = stockProducto;
      await this.stockRepo.save(balance);
    }
    return stockProducto;
  }

  /**
   * Stock bajo si Bodega Central o cualquiera de los puntos de venta activos
   * con stock cargado queda en el mínimo o por debajo.
   */
  async obtenerUbicacionesBajoMinimo(
    productId: string,
    stockMinimo: number,
    stockCentral: number,
  ): Promise<UbicacionAlertaStock[]> {
    const minimo = Math.max(0, Number(stockMinimo) || 0);
    const centralStock = Math.max(0, Number(stockCentral) || 0);
    const bajas: UbicacionAlertaStock[] = [];

    const ubicaciones = await this.ubicacionesRepo.find({
      order: { Id: 'ASC' },
    });
    const puntosVenta = ubicaciones.filter(
      (ubicacion) =>
        ubicacion.Activo !== false &&
        !UBICACIONES_SIN_ALERTA.has(String(ubicacion.Codigo || '')) &&
        (ubicacion.Codigo === BODEGA_CENTRAL ||
          String(ubicacion.Codigo || '').startsWith('POS_')),
    );

    const balances = await this.stockRepo.find({
      where: { ProductoId: String(productId) },
    });
    const stockPorUbicacion = new Map(
      balances.map((row) => [
        Number(row.UbicacionId),
        Math.max(0, Number(row.Stock) || 0),
      ]),
    );

    for (const ubicacion of puntosVenta) {
      const esCentral = ubicacion.Codigo === BODEGA_CENTRAL;
      const tieneFila = stockPorUbicacion.has(Number(ubicacion.Id));

      // En POS solo contamos ubicaciones con stock cargado (fila existente).
      // Así el umbral aplica en cualquiera de los puntos de venta reales,
      // sin spamear puntos donde nunca se ha puesto el producto.
      if (!esCentral && !tieneFila) continue;

      const stock = esCentral
        ? centralStock
        : (stockPorUbicacion.get(Number(ubicacion.Id)) ?? 0);

      if (stock > minimo) continue;

      bajas.push({
        codigo: ubicacion.Codigo,
        nombre: ubicacion.Nombre || ubicacion.Codigo,
        stock,
      });
    }

    return bajas;
  }

  /**
   * Tras cualquier salida/entrada de stock: actualiza Disponible y AlertaStock.
   * Si la alerta pasa de false → true, avisa por correo a SuperAdmin.
   * La alerta se dispara si Bodega Central o cualquier punto de venta
   * tiene stock <= stock mínimo.
   */
  async verificarTrasMovimiento(productId: string): Promise<Producto | null> {
    if (!productId?.trim()) return null;
    const producto = await this.productosRepo.findOne({
      where: { Id: String(productId) },
    });
    if (!producto) return null;

    await this.sincronizarBodegaConProducto(producto);

    const stockActual = Math.max(0, Number(producto.Stock) || 0);
    const stockTotal = await this.obtenerStockTotal(
      String(producto.Id),
      stockActual,
    );
    const stockMinimo = Math.max(0, Number(producto.StockMinimo) || 0);
    const ubicacionesBajas = await this.obtenerUbicacionesBajoMinimo(
      String(producto.Id),
      stockMinimo,
      stockActual,
    );
    const alertaAnterior = Boolean(producto.AlertaStock);
    const alertaNueva = ubicacionesBajas.length > 0;
    const disponible = stockTotal > 0;
    const stockPeor = alertaNueva
      ? Math.min(...ubicacionesBajas.map((item) => item.stock))
      : stockActual;

    producto.AlertaStock = alertaNueva;
    producto.Disponible = disponible;
    if (stockTotal <= 0) producto.EsDestacado = false;

    const guardado = await this.productosRepo.save(producto);

    if (alertaNueva && !alertaAnterior) {
      try {
        await this.notificarSuperAdmins(guardado, stockPeor, ubicacionesBajas);
      } catch (err) {
        this.logger.error(
          `No se pudo notificar stock bajo del producto ${guardado.Id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return guardado;
  }

  async listarAlertas(): Promise<ProductoAlertaStock[]> {
    const productos = await this.productosRepo.find({
      order: { Nombre: 'ASC' },
    });

    const result: ProductoAlertaStock[] = [];
    for (const producto of productos) {
      const stockMinimo = Math.max(0, Number(producto.StockMinimo) || 0);
      const stockCentral = Math.max(0, Number(producto.Stock) || 0);
      const ubicaciones = await this.obtenerUbicacionesBajoMinimo(
        String(producto.Id),
        stockMinimo,
        stockCentral,
      );
      if (ubicaciones.length === 0) continue;

      const stockActual = Math.min(...ubicaciones.map((item) => item.stock));
      result.push({
        id: String(producto.Id),
        nombre: producto.Nombre,
        stockActual,
        stockMinimo,
        agotado: stockActual <= 0,
        alertaStock: true,
        disponible: stockActual > 0,
        ubicaciones,
      });
    }
    return result;
  }

  private async notificarSuperAdmins(
    producto: Producto,
    stockActual: number,
    ubicacionesBajas: UbicacionAlertaStock[],
  ): Promise<void> {
    const usuarios = await this.usuariosRepo.find();
    const destinos = usuarios.filter((u) => {
      if (String(u.Estado || '').toLowerCase() !== 'activo') return false;
      const roles = Array.isArray(u.Roles) ? u.Roles : [];
      return roles.some(
        (rol) => String(rol).toLowerCase() === 'superadmin',
      );
    });

    if (destinos.length === 0) {
      this.logger.warn(
        'Stock bajo sin SuperAdmin activo para notificar por correo.',
      );
      return;
    }

    const ubicacionNombre =
      ubicacionesBajas
        .map((item) => `${item.nombre} (${item.stock})`)
        .join(', ') || 'Inventario';

    await Promise.all(
      destinos.map((admin) =>
        this.emailService.enviarAlertaStockBajo(admin.Correo, {
          nombreAdmin: admin.Nombre,
          nombreProducto: producto.Nombre,
          stockActual,
          stockMinimo: Number(producto.StockMinimo) || 0,
          productoId: String(producto.Id),
          ubicacionNombre,
        }),
      ),
    );
  }
}
