import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AjustesController } from '../controllers/ajustes.controller';
import { AjusteSistema } from '../entities/ajuste-sistema.entity';
import { CatalogoSistemaItem } from '../entities/catalogo-sistema-item.entity';
import { DisponibilidadGrupo } from '../entities/disponibilidad-grupo.entity';
import { Permiso } from '../entities/permiso.entity';
import { Rol } from '../entities/rol.entity';
import { RolPermiso } from '../entities/rol-permiso.entity';
import { AjustesSistemaService } from '../services/ajustes-sistema.service';
import { CatalogoSistemaService } from '../services/catalogo-sistema.service';
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
      CatalogoSistemaItem,
    ]),
    AuthModule,
  ],
  controllers: [AjustesController],
  providers: [
    PermisosCatalogoService,
    DisponibilidadGruposService,
    AjustesSistemaService,
    CatalogoSistemaService,
  ],
  exports: [
    PermisosCatalogoService,
    DisponibilidadGruposService,
    AjustesSistemaService,
  ],
})
export class AjustesModule {}
