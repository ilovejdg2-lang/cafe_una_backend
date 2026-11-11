import { Module } from '@nestjs/common';
import { SolicitudesClienteController } from '../controllers/solicitudes-cliente.controller';
import { SolicitudesClienteService } from '../services/solicitudes-cliente.service';
import { AuthModule } from './auth.module';
import { DocumentosModule } from './documentos.module';
import { DonacionesModule } from './donaciones.module';
import { PropuestasProductoresModule } from './propuestas-productores.module';
import { UsuariosModule } from './usuarios.module';
import { VisitasModule } from './visitas.module';
import { VoluntariadoModule } from './voluntariado.module';

@Module({
  imports: [
    AuthModule,
    DonacionesModule,
    VoluntariadoModule,
    VisitasModule,
    DocumentosModule,
    PropuestasProductoresModule,
    UsuariosModule,
  ],
  controllers: [SolicitudesClienteController],
  providers: [SolicitudesClienteService],
  exports: [SolicitudesClienteService],
})
export class SolicitudesClienteModule {}
