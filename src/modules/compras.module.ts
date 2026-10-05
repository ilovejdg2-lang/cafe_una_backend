import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComprasController } from '../controllers/compras.controller';
import { CompraItem } from '../entities/compra-item.entity';
import { Compra } from '../entities/compra.entity';
import { Producto } from '../entities/producto.entity';
import { ComprasService } from '../services/compras.service';
import { AuthModule } from './auth.module';
import { FacturasModule } from './facturas.module';
import { AsignacionesPuntoVentaModule } from './asignaciones-punto-venta.module';
import { UsuariosModule } from './usuarios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Compra, CompraItem, Producto]),
    AuthModule,
    UsuariosModule,
    FacturasModule,
    AsignacionesPuntoVentaModule,
  ],
  controllers: [ComprasController],
  providers: [ComprasService],
  exports: [ComprasService],
})
export class ComprasModule {}
