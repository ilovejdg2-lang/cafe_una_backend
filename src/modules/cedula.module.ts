import { Module } from '@nestjs/common';
import { CedulaController } from '../controllers/cedula.controller';
import { CedulaConsultaService } from '../services/cedula-consulta.service';

@Module({
  controllers: [CedulaController],
  providers: [CedulaConsultaService],
})
export class CedulaModule {}
