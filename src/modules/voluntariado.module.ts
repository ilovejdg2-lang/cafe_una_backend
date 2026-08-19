import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoluntariadoController } from '../controllers/voluntariado.controller';
import { SolicitudVoluntariado } from '../entities/solicitud-voluntariado.entity';
import { VoluntariadoService } from '../services/voluntariado.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudVoluntariado]), AuthModule],
  controllers: [VoluntariadoController],
  providers: [VoluntariadoService],
})
export class VoluntariadoModule {}
