import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerfilController } from '../controllers/perfil.controller';
import { PerfilImagenesController } from '../controllers/perfil-imagenes.controller';
import { PerfilImagenStorage } from '../services/perfil-imagen.storage';
import { CambioCorreoPendiente } from '../entities/cambio-correo-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import { PerfilService } from '../services/perfil.service';
import { AuthModule } from './auth.module';
import { UsuariosModule } from './usuarios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, CambioCorreoPendiente]),
    forwardRef(() => UsuariosModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [PerfilController, PerfilImagenesController],
  providers: [PerfilService, PerfilImagenStorage],
  exports: [PerfilService],
})
export class PerfilModule {}
