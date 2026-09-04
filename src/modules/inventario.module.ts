import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioController } from '../controllers/inventario.controller';
import { MovimientosController } from '../controllers/movimientos.controller';
import { TransferenciasController } from '../controllers/transferencias.controller';
import { VentasPresencialesController } from '../controllers/ventas-presenciales.controller';
import {
  Compra,
  CompraItem,
  InventarioStockUbicacion,
  InventarioUbicacion,
  MovimientoInventario,
  Producto,
  Transferencia,
  Usuario,
} from '../entities';
import { InventarioService } from '../services/inventario.service';
import { MovimientosService } from '../services/movimientos.service';
import { StockAlertaService } from '../services/stock-alerta.service';
import { VentasPresencialesService } from '../services/ventas-presenciales.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventarioUbicacion,
      InventarioStockUbicacion,
      Producto,
      Usuario,
      Transferencia,
      MovimientoInventario,
      Compra,
      CompraItem,
    ]),
    AuthModule,
  ],
  controllers: [
    InventarioController,
    MovimientosController,
    TransferenciasController,
    VentasPresencialesController,
  ],
  providers: [
    InventarioService,
    MovimientosService,
    StockAlertaService,
    VentasPresencialesService,
  ],
  exports: [
    InventarioService,
    MovimientosService,
    StockAlertaService,
    VentasPresencialesService,
  ],
})
export class InventarioModule {}
