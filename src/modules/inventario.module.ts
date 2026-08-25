import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InventarioStockUbicacion,
  InventarioUbicacion,
  Producto,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventarioUbicacion,
      InventarioStockUbicacion,
      Producto,
    ]),
  ],
})
export class InventarioModule {}
