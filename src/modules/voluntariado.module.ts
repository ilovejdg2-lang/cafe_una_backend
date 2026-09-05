import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoluntariadoController } from '../controllers/voluntariado.controller';
import { FechasVoluntariadoController } from '../controllers/fechas-voluntariado.controller';
import { SolicitudVoluntariado } from '../entities/solicitud-voluntariado.entity';
import { FechaVoluntariado } from '../entities/fecha-voluntariado.entity';
import { VoluntariadoService } from '../services/voluntariado.service';
import { FechasVoluntariadoService } from '../services/fechas-voluntariado.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SolicitudVoluntariado, FechaVoluntariado]),
    AuthModule,
  ],
  controllers: [VoluntariadoController, FechasVoluntariadoController],
  providers: [VoluntariadoService, FechasVoluntariadoService],
  exports: [VoluntariadoService, FechasVoluntariadoService],
})
export class VoluntariadoModule {}
