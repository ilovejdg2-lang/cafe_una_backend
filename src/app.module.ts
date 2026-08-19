import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { construirConfigMysql } from './config/mysql.config';
import { HealthController } from './controllers/health.controller';
import { AuthModule } from './modules/auth.module';
import { CedulaModule } from './modules/cedula.module';
import { DatabaseModule } from './modules/database.module';
import { InformacionModule } from './modules/informacion.module';
import { PerfilModule } from './modules/perfil.module';
import { ProductosModule } from './modules/productos.module';
import { UsuariosModule } from './modules/usuarios.module';
import { VoluntariadoModule } from './modules/voluntariado.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => construirConfigMysql(config),
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
