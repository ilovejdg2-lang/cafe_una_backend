import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificacionesController } from '../controllers/notificaciones.controller';
import { ProductoresPublicosController } from '../controllers/productores-publicos.controller';
import { PropuestasProductoresController } from '../controllers/propuestas-productores.controller';
import { CorreoSalida } from '../entities/correo-salida.entity';
import { InformacionFooter } from '../entities/informacion-footer.entity';
import { Notificacion } from '../entities/notificacion.entity';
import { PropuestaProductor } from '../entities/propuesta-productor.entity';
import { Usuario } from '../entities/usuario.entity';
import { CorreosSalidaService } from '../services/correos-salida.service';
import { NotificacionesPropuestasService } from '../services/notificaciones-propuestas.service';
import { PropuestaImagenStorage } from '../services/propuesta-imagen.storage';
import { PropuestasProductoresService } from '../services/propuestas-productores.service';
import { SupabaseStorageService } from '../services/supabase-storage.service';
import { AuthModule } from './auth.module';
import { UsuariosModule } from './usuarios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PropuestaProductor,
      Notificacion,
      CorreoSalida,
      InformacionFooter,
      Usuario,
    ]),
    AuthModule,
    UsuariosModule,
  ],
  controllers: [
    ProductoresPublicosController,
    PropuestasProductoresController,
    NotificacionesController,
  ],
  providers: [
    PropuestasProductoresService,
    NotificacionesPropuestasService,
    CorreosSalidaService,
    PropuestaImagenStorage,
    SupabaseStorageService,
  ],
})
export class PropuestasProductoresModule {}
