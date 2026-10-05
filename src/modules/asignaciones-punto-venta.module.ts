import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';
import { Usuario } from '../entities/usuario.entity';
import { VendedorPuntoVenta } from '../entities/vendedor-punto-venta.entity';
import { AsignacionesPuntoVentaService } from '../services/asignaciones-punto-venta.service';

@Module({
  imports: [TypeOrmModule.forFeature([VendedorPuntoVenta, InventarioUbicacion, Usuario])],
  providers: [AsignacionesPuntoVentaService],
  exports: [AsignacionesPuntoVentaService],
})
export class AsignacionesPuntoVentaModule {}
