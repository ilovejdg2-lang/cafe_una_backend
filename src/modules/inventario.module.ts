import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioController } from '../controllers/inventario.controller';
import { TransferenciasController } from '../controllers/transferencias.controller';
import {
  InventarioStockUbicacion,
  InventarioUbicacion,
  Producto,
  Usuario,
} from '../entities';
import { InventarioService } from '../services/inventario.service';
import { StockAlertaService } from '../services/stock-alerta.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventarioUbicacion,
      InventarioStockUbicacion,
      Producto,
      Usuario,
    ]),
    AuthModule,
  ],
  controllers: [InventarioController, TransferenciasController],
  providers: [InventarioService, StockAlertaService],
  exports: [InventarioService, StockAlertaService],
})
export class InventarioModule {}
