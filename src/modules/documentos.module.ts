import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Documento } from '../entities/documento.entity';
import { DescargaDocumento } from '../entities/descarga-documento.entity';
import { SolicitudDocumento } from '../entities/solicitud-documento.entity';
import { DocumentosController } from '../controllers/documentos.controller';
import { DocumentosService } from '../services/documentos.service';
import { SupabaseStorageService } from '../services/supabase-storage.service';
import { AuthModule } from './auth.module';
import { CategoriasModule } from './categorias.module';
import { EmailModule } from './email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Documento, DescargaDocumento, SolicitudDocumento]),
    AuthModule,
    CategoriasModule,
    EmailModule,
  ],
  controllers: [DocumentosController],
  providers: [DocumentosService, SupabaseStorageService],
  exports: [DocumentosService, SupabaseStorageService],
})
export class DocumentosModule {}
