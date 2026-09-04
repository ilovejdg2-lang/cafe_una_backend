import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DonacionSolicitudesController } from '../controllers/donacion-solicitudes.controller';
import { NecesidadesController } from '../controllers/necesidades.controller';
import { DonacionNecesidad } from '../entities/donacion-necesidad.entity';
import { DonacionSolicitud } from '../entities/donacion-solicitud.entity';
import { NECESIDAD_REPOSITORY } from '../repositories/necesidad.repository.interface';
import { NecesidadRepository } from '../repositories/necesidad.repository';
import { DonacionSolicitudesService } from '../services/donacion-solicitudes.service';
import { NecesidadesService } from '../services/necesidades.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DonacionNecesidad, DonacionSolicitud]),
    AuthModule,
  ],
  controllers: [NecesidadesController, DonacionSolicitudesController],
  providers: [
    NecesidadesService,
    DonacionSolicitudesService,
    NecesidadRepository,
    { provide: NECESIDAD_REPOSITORY, useExisting: NecesidadRepository },
  ],
  exports: [NecesidadesService, DonacionSolicitudesService],
})
export class DonacionesModule {}
