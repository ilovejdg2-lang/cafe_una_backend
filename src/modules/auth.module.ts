import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from '../controllers/auth.controller';
import { PasswordResetEntry } from '../entities/password-reset-entry.entity';
import { RegistroPendiente } from '../entities/registro-pendiente.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { AuthService } from '../services/auth.service';
import { JwtStrategy } from '../services/jwt.strategy';
import { UsuariosModule } from './usuarios.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([RegistroPendiente, PasswordResetEntry]),
    forwardRef(() => UsuariosModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, PermisosGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, PermisosGuard, PassportModule],
})
export class AuthModule {}
