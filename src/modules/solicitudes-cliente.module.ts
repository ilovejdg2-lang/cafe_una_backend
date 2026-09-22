import { Module } from '@nestjs/common';
import { SolicitudesClienteController } from '../controllers/solicitudes-cliente.controller';
import { SolicitudesClienteService } from '../services/solicitudes-cliente.service';
import { AuthModule } from './auth.module';
import { DonacionesModule } from './donaciones.module';
import { VisitasModule } from './visitas.module';
import { VoluntariadoModule } from './voluntariado.module';

@Module({
  imports: [AuthModule, DonacionesModule, VoluntariadoModule, VisitasModule],
  controllers: [SolicitudesClienteController],
  providers: [SolicitudesClienteService],
  exports: [SolicitudesClienteService],
})
export class SolicitudesClienteModule {}
