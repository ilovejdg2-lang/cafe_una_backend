import { Module } from '@nestjs/common';
import { CedulaController } from './cedula.controller';
import { CedulaConsultaService } from './cedula-consulta.service';

@Module({
  controllers: [CedulaController],
  providers: [CedulaConsultaService],
})
export class CedulaModule {}
