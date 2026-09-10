import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from '../common/email.service';
import { UsuariosController } from '../controllers/usuarios.controller';
import { ClienteJuridico } from '../entities/cliente-juridico.entity';
import { Cliente } from '../entities/cliente.entity';
import { UsuarioCreacionPendiente } from '../entities/usuario-creacion-pendiente.entity';
import { Usuario } from '../entities/usuario.entity';
import { ClientesService } from '../services/clientes.service';
import { UsuariosAdminService } from '../services/usuarios-admin.service';
import { UsuariosService } from '../services/usuarios.service';
import { PerfilModule } from './perfil.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      UsuarioCreacionPendiente,
      Cliente,
      ClienteJuridico,
    ]),
    forwardRef(() => PerfilModule),
  ],
  controllers: [UsuariosController],
  providers: [
    UsuariosService,
    UsuariosAdminService,
    ClientesService,
    EmailService,
  ],
  exports: [UsuariosService, ClientesService, EmailService],
})
export class UsuariosModule {}
