import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoluntariadoController } from '../controllers/voluntariado.controller';
import { SolicitudVoluntariado } from '../entities/solicitud-voluntariado.entity';
import { VoluntariadoService } from '../services/voluntariado.service';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudVoluntariado])],
  controllers: [VoluntariadoController],
  providers: [VoluntariadoService],
})
export class VoluntariadoModule {}
