import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriasController } from '../controllers/categorias.controller';
import { Categoria } from '../entities/categoria.entity';
import { GaleriaInstitucionalItem } from '../entities/galeria-institucional-item.entity';
import { Producto } from '../entities/producto.entity';
import { CategoriasService } from '../services/categorias.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Categoria, Producto, GaleriaInstitucionalItem]),
    AuthModule,
  ],
  controllers: [CategoriasController],
  providers: [CategoriasService],
  exports: [CategoriasService],
})
export class CategoriasModule {}
