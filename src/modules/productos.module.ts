import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosController } from '../controllers/productos.controller';
import { Producto } from '../entities/producto.entity';
import { ProductosService } from '../services/productos.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Producto]), AuthModule],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
