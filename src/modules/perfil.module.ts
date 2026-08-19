import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from '../common/email.service';
import { PerfilController } from '../controllers/perfil.controller';
import { CambioCorreoPendiente } from '../entities/cambio-correo-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import { PerfilService } from '../services/perfil.service';
import { UsuariosModule } from './usuarios.module';

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
