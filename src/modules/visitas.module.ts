import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VisitasController } from '../controllers/visitas.controller';
import { VisitasDisponibilidadController } from '../controllers/visitas-disponibilidad.controller';
import { DisponibilidadVisita } from '../entities/disponibilidad-visita.entity';
import { TurnoVisita } from '../entities/turno-visita.entity';
import { VisitaGrupal } from '../entities/visita-grupal.entity';
import { VisitasService } from '../services/visitas.service';
import { VisitasDisponibilidadService } from '../services/visitas-disponibilidad.service';
import { VisitasInstructivoPdfService } from '../services/visitas-instructivo-pdf.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VisitaGrupal,
      DisponibilidadVisita,
      TurnoVisita,
    ]),
    AuthModule,
  ],
  controllers: [VisitasController, VisitasDisponibilidadController],
  providers: [
    VisitasService,
    VisitasDisponibilidadService,
    VisitasInstructivoPdfService,
  ],
  exports: [
    VisitasService,
    VisitasDisponibilidadService,
    VisitasInstructivoPdfService,
  ],
})
export class VisitasModule {}
