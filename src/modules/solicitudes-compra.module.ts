import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProveedoresController } from '../controllers/proveedores.controller';
import { SolicitudesCompraController } from '../controllers/solicitudes-compra.controller';
import {
  DetalleSolicitud,
  MovimientoInventario,
  Producto,
  Proveedor,
  SolicitudCompra,
} from '../entities';
import { SolicitudesCompraService } from '../services/solicitudes-compra.service';
import { AuthModule } from './auth.module';
import { InventarioModule } from './inventario.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Proveedor,
      SolicitudCompra,
      DetalleSolicitud,
      MovimientoInventario,
      Producto,
    ]),
    AuthModule,
    InventarioModule,
  ],
  controllers: [SolicitudesCompraController, ProveedoresController],
  providers: [SolicitudesCompraService],
  exports: [SolicitudesCompraService],
})
export class SolicitudesCompraModule {}
