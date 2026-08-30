import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaContextInterceptor } from './common/auditoria-context.interceptor';
import { construirConfigPostgres } from './config/postgres.config';
import { HealthController } from './controllers/health.controller';
import { ActivosFijosModule } from './modules/activos-fijos.module';
import { ComprasModule } from './modules/compras.module';
import { InventarioModule } from './modules/inventario.module';
import { AuthModule } from './modules/auth.module';
import { AuditoriaModule } from './modules/auditoria.module';
import { AjustesModule } from './modules/ajustes.module';
import { CedulaModule } from './modules/cedula.module';
import { DatabaseModule } from './modules/database.module';
import { EmailModule } from './modules/email.module';
import { InformacionModule } from './modules/informacion.module';
import { PerfilModule } from './modules/perfil.module';
import { ProductosModule } from './modules/productos.module';
import { CategoriasModule } from './modules/categorias.module';
import { UsuariosModule } from './modules/usuarios.module';
import { VoluntariadoModule } from './modules/voluntariado.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => construirConfigPostgres(config),
    }),
    EmailModule,
    DatabaseModule,
    UsuariosModule,
    forwardRef(() => PerfilModule),
    AuthModule,
    ProductosModule,
    CategoriasModule,
    InventarioModule,
    ActivosFijosModule,
    ComprasModule,
    InformacionModule,
    VoluntariadoModule,
    CedulaModule,
    AuditoriaModule,
    AjustesModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditoriaContextInterceptor,
    },
  ],
})
export class AppModule {}
