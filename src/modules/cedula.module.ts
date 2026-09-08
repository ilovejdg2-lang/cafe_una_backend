import { Module } from '@nestjs/common';
import { CedulaController } from '../controllers/cedula.controller';
import { CedulaConsultaService } from '../services/cedula-consulta.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CedulaController],
  providers: [CedulaConsultaService],
})
export class CedulaModule {}
