import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivosFijosController } from '../controllers/activos-fijos.controller';
import { ActivoFijo } from '../entities/activo-fijo.entity';
import { ActivosFijosService } from '../services/activos-fijos.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([ActivoFijo]), AuthModule],
  controllers: [ActivosFijosController],
  providers: [ActivosFijosService],
  exports: [ActivosFijosService],
})
export class ActivosFijosModule {}
