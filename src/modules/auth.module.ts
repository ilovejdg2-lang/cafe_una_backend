import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { EmailModule } from './email.module';
import { UsuariosModule } from './usuarios.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET')?.trim();
        if (!secret || secret.length < 32) {
          throw new Error(
            'JWT_SECRET debe existir y tener al menos 32 caracteres.',
          );
        }
        const issuer = config.get<string>('JWT_ISSUER')?.trim();
        const audience = config.get<string>('JWT_AUDIENCE')?.trim();
        return {
          secret,
          signOptions: {
            ...(issuer ? { issuer } : {}),
            ...(audience ? { audience } : {}),
            expiresIn: '1h',
          },
        };
      },
    }),
    TypeOrmModule.forFeature([RegistroPendiente, PasswordResetEntry]),
    EmailModule,
    forwardRef(() => UsuariosModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, PermisosGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, PermisosGuard, PassportModule],
})
export class AuthModule {}
