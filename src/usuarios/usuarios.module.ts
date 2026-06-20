import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from '../common/email.service';
import { UsuarioCreacionPendiente } from '../entities/usuario-creacion-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import { PerfilModule } from '../perfil/perfil.module';
import { UsuariosAdminService } from './usuarios-admin.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

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
