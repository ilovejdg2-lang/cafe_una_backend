import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarritoController } from '../controllers/carrito.controller';
import { CarritoItem } from '../entities/carrito-item.entity';
import { Producto } from '../entities/producto.entity';
import { CarritoService } from '../services/carrito.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([CarritoItem, Producto])],
  controllers: [CarritoController],
  providers: [CarritoService],
})
export class CarritoModule {}
