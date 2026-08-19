import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from '../common/email.service';
import { UsuariosController } from '../controllers/usuarios.controller';
import { UsuarioCreacionPendiente } from '../entities/usuario-creacion-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import { UsuariosAdminService } from '../services/usuarios-admin.service';
import { UsuariosService } from '../services/usuarios.service';
import { PerfilModule } from './perfil.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, UsuarioCreacionPendiente]),
    forwardRef(() => PerfilModule),
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService, UsuariosAdminService, EmailService],
  exports: [UsuariosService, EmailService],
})
export class UsuariosModule {}
