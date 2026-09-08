import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VisitasController } from '../controllers/visitas.controller';
import { VisitaGrupal } from '../entities/visita-grupal.entity';
import { VisitasService } from '../services/visitas.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([VisitaGrupal]), AuthModule],
  controllers: [VisitasController],
  providers: [VisitasService],
  exports: [VisitasService],
})
export class VisitasModule {}
