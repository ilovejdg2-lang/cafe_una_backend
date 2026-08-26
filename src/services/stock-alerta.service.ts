import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../common/email.service';
import { InventarioStockUbicacion } from '../entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Producto } from '../entities/producto.entity';
import { Usuario } from '../entities/usuario.entity';

const BODEGA_CENTRAL = 'BODEGA_CENTRAL';

export type ProductoAlertaStock = {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  agotado: boolean;
  alertaStock: boolean;
  disponible: boolean;
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
   * Tras cualquier salida/entrada de stock: actualiza Disponible y AlertaStock.
   * Si la alerta pasa de false → true, avisa por correo a SuperAdmin.
   * La alerta se dispara apenas el stock de Bodega Central (productos.Stock) sea <= stock mínimo.
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
    const alertaAnterior = Boolean(producto.AlertaStock);
    const alertaNueva = stockActual <= stockMinimo;
    const disponible = stockTotal > 0;

    producto.AlertaStock = alertaNueva;
    producto.Disponible = disponible;
    if (stockTotal <= 0) producto.EsDestacado = false;

    const guardado = await this.productosRepo.save(producto);

    if (alertaNueva && !alertaAnterior) {
      try {
        await this.notificarSuperAdmins(guardado, stockActual);
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
      const stockActual = Math.max(0, Number(producto.Stock) || 0);
      if (stockActual > stockMinimo) continue;

      result.push({
        id: String(producto.Id),
        nombre: producto.Nombre,
        stockActual,
        stockMinimo,
        agotado: stockActual <= 0,
        alertaStock: true,
        disponible: stockActual > 0,
      });
    }
    return result;
  }

  private async notificarSuperAdmins(
    producto: Producto,
    stockActual: number,
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

    await Promise.all(
      destinos.map((admin) =>
        this.emailService.enviarAlertaStockBajo(admin.Correo, {
          nombreAdmin: admin.Nombre,
          nombreProducto: producto.Nombre,
          stockActual,
          stockMinimo: Number(producto.StockMinimo) || 0,
          productoId: String(producto.Id),
        }),
      ),
    );
  }
}
