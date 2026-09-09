import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DonacionSolicitudesController } from '../controllers/donacion-solicitudes.controller';
import { FechasRecepcionDonacionController } from '../controllers/fechas-recepcion-donacion.controller';
import { NecesidadesController } from '../controllers/necesidades.controller';
import { DonacionNecesidad } from '../entities/donacion-necesidad.entity';
import { DonacionMaterialAceptado } from '../entities/donacion-material-aceptado.entity';
import { DonacionSolicitud } from '../entities/donacion-solicitud.entity';
import { FechaRecepcionDonacion } from '../entities/fecha-recepcion-donacion.entity';
import { DonacionMaterialesService } from '../services/donacion-materiales.service';
import { FechasRecepcionDonacionService } from '../services/fechas-recepcion-donacion.service';
import { NECESIDAD_REPOSITORY } from '../repositories/necesidad.repository.interface';
import { NecesidadRepository } from '../repositories/necesidad.repository';
import { DonacionSolicitudesService } from '../services/donacion-solicitudes.service';
import { NecesidadesService } from '../services/necesidades.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DonacionNecesidad,
      DonacionMaterialAceptado,
      DonacionSolicitud,
      FechaRecepcionDonacion,
    ]),
    AuthModule,
  ],
  controllers: [
    NecesidadesController,
    DonacionSolicitudesController,
    FechasRecepcionDonacionController,
  ],
  providers: [
    NecesidadesService,
    DonacionMaterialesService,
    FechasRecepcionDonacionService,
    DonacionSolicitudesService,
    NecesidadRepository,
    { provide: NECESIDAD_REPOSITORY, useExisting: NecesidadRepository },
  ],
  exports: [
    NecesidadesService,
    DonacionMaterialesService,
    FechasRecepcionDonacionService,
    DonacionSolicitudesService,
  ],
})
export class DonacionesModule {}
