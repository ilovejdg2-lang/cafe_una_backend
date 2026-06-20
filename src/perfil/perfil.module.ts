import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from '../common/email.service';
import { CambioCorreoPendiente } from '../entities/cambio-correo-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PerfilController } from './perfil.controller';
import { PerfilService } from './perfil.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, CambioCorreoPendiente]),
    forwardRef(() => UsuariosModule),
  ],
  controllers: [PerfilController],
  providers: [PerfilService, EmailService],
  exports: [PerfilService],
})
export class PerfilModule {}
