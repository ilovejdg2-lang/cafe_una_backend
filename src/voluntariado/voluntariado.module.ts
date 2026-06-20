import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudVoluntariado } from '../entities/solicitud-voluntariado.entity';
import { VoluntariadoController } from './voluntariado.controller';
import { VoluntariadoService } from './voluntariado.service';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudVoluntariado])],
  controllers: [VoluntariadoController],
  providers: [VoluntariadoService],
})
export class VoluntariadoModule {}
