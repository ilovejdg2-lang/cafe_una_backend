import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosController } from '../controllers/productos.controller';
import { Producto } from '../entities/producto.entity';
import { ProductosService } from '../services/productos.service';
import { AuthModule } from './auth.module';
import { InventarioModule } from './inventario.module';
import { CategoriasModule } from './categorias.module';

@Module({
  imports: [TypeOrmModule.forFeature([Producto]), AuthModule, InventarioModule, CategoriasModule],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
