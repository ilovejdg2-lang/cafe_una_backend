import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VisitasController } from '../controllers/visitas.controller';
import { VisitasDisponibilidadController } from '../controllers/visitas-disponibilidad.controller';
import { DisponibilidadVisita } from '../entities/disponibilidad-visita.entity';
import { VisitaGrupal } from '../entities/visita-grupal.entity';
import { VisitasService } from '../services/visitas.service';
import { VisitasDisponibilidadService } from '../services/visitas-disponibilidad.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VisitaGrupal, DisponibilidadVisita]),
    AuthModule,
  ],
  controllers: [VisitasController, VisitasDisponibilidadController],
  providers: [VisitasService, VisitasDisponibilidadService],
  exports: [VisitasService, VisitasDisponibilidadService],
})
export class VisitasModule {}
