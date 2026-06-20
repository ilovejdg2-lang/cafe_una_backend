import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { buildSupabaseTypeOrmConfig } from './config/supabase.config';
import { CedulaModule } from './cedula/cedula.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { InformacionModule } from './informacion/informacion.module';
import { PerfilModule } from './perfil/perfil.module';
import { ProductosModule } from './productos/productos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VoluntariadoModule } from './voluntariado/voluntariado.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildSupabaseTypeOrmConfig(config),
    }),
    DatabaseModule,
    UsuariosModule,
    forwardRef(() => PerfilModule),
    AuthModule,
    ProductosModule,
    InformacionModule,
    VoluntariadoModule,
    CedulaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
