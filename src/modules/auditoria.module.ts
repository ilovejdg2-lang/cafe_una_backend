import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaController } from '../controllers/auditoria.controller';
import { Auditoria } from '../entities/auditoria.entity';
import { AuditoriaService } from '../services/auditoria.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Auditoria]), AuthModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
})
export class AuditoriaModule {}
