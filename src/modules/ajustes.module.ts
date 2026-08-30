import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AjustesController } from '../controllers/ajustes.controller';
import { AjusteSistema } from '../entities/ajuste-sistema.entity';
import { DisponibilidadGrupo } from '../entities/disponibilidad-grupo.entity';
import { Permiso } from '../entities/permiso.entity';
import { Rol } from '../entities/rol.entity';
import { RolPermiso } from '../entities/rol-permiso.entity';
import { AjustesSistemaService } from '../services/ajustes-sistema.service';
import { DisponibilidadGruposService } from '../services/disponibilidad-grupos.service';
import { PermisosCatalogoService } from '../services/permisos-catalogo.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rol,
      Permiso,
      RolPermiso,
      DisponibilidadGrupo,
      AjusteSistema,
    ]),
    AuthModule,
  ],
  controllers: [AjustesController],
  providers: [
    PermisosCatalogoService,
    DisponibilidadGruposService,
    AjustesSistemaService,
  ],
  exports: [
    PermisosCatalogoService,
    DisponibilidadGruposService,
    AjustesSistemaService,
  ],
})
export class AjustesModule {}
