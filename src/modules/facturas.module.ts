import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturasController } from '../controllers/facturas.controller';
import { CompraItem } from '../entities/compra-item.entity';
import { Compra } from '../entities/compra.entity';
import { FacturaItem } from '../entities/factura-item.entity';
import { Factura } from '../entities/factura.entity';
import { FACTURA_REPOSITORY } from '../repositories/factura.repository.interface';
import { FacturaRepository } from '../repositories/factura.repository';
import { FacturaPdfService } from '../services/factura-pdf.service';
import { FacturasNotificacionesService } from '../services/facturas-notificaciones.service';
import { FacturasService } from '../services/facturas.service';
import { AuthModule } from './auth.module';
import { UsuariosModule } from './usuarios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Factura, FacturaItem, Compra, CompraItem]),
    AuthModule,
    UsuariosModule,
  ],
  controllers: [FacturasController],
  providers: [
    {
      provide: FACTURA_REPOSITORY,
      useClass: FacturaRepository,
    },
    FacturaRepository,
    FacturaPdfService,
    FacturasNotificacionesService,
    FacturasService,
  ],
  exports: [
    FacturasService,
    FacturasNotificacionesService,
    FACTURA_REPOSITORY,
    FacturaRepository,
    FacturaPdfService,
  ],
})
export class FacturasModule {}
