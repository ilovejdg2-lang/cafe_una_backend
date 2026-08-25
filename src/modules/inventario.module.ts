import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioController } from '../controllers/inventario.controller';
import {
  InventarioStockUbicacion,
  InventarioUbicacion,
  Producto,
} from '../entities';
import { InventarioService } from '../services/inventario.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventarioUbicacion,
      InventarioStockUbicacion,
      Producto,
    ]),
    AuthModule,
  ],
  controllers: [InventarioController],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventarioModule {}
