import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from '../common/email.service';
import { PasswordResetEntry } from '../entities/password-reset-entry.entity';
import { RegistroPendiente } from '../entities/registro-pendiente.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([RegistroPendiente, PasswordResetEntry]),
    UsuariosModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
