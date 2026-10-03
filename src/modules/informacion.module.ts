import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InformacionController } from '../controllers/informacion.controller';
import { EnlaceSitio } from '../entities/enlace-sitio.entity';
import { EquipoMiembro } from '../entities/equipo-miembro.entity';
import { FaqInicio } from '../entities/faq-inicio.entity';
import { GaleriaInstitucionalItem } from '../entities/galeria-institucional-item.entity';
import { HeroPrincipal } from '../entities/hero-principal.entity';
import { HistoriaCompleta } from '../entities/historia-completa.entity';
import { InformacionFooter } from '../entities/informacion-footer.entity';
import { InformacionNavbar } from '../entities/informacion-navbar.entity';
import { TarjetaInicio } from '../entities/tarjeta-inicio.entity';
import { TextoInstitucional } from '../entities/texto-institucional.entity';
import { EnlaceSitioService } from '../services/enlace-sitio.service';
import { EquipoMiembroService } from '../services/equipo-miembro.service';
import { FaqInicioService } from '../services/faq-inicio.service';
import { GaleriaInstitucionalService } from '../services/galeria-institucional.service';
import { HeroService } from '../services/hero.service';
import { HistoriaCompletaService } from '../services/historia-completa.service';
import { InformacionFooterService } from '../services/informacion-footer.service';
import { InformacionNavbarService } from '../services/informacion-navbar.service';
import { SupabaseStorageService } from '../services/supabase-storage.service';
import { TarjetaInicioService } from '../services/tarjeta-inicio.service';
import { TextoInstitucionalService } from '../services/texto-institucional.service';
import { AuthModule } from './auth.module';
import { CategoriasModule } from './categorias.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HeroPrincipal,
      TextoInstitucional,
      GaleriaInstitucionalItem,
      InformacionFooter,
      InformacionNavbar,
      EnlaceSitio,
      FaqInicio,
      TarjetaInicio,
      EquipoMiembro,
      HistoriaCompleta,
    ]),
    AuthModule,
    CategoriasModule,
  ],
  controllers: [InformacionController],
  providers: [
    HeroService,
    TextoInstitucionalService,
    GaleriaInstitucionalService,
    InformacionFooterService,
    InformacionNavbarService,
    EnlaceSitioService,
    FaqInicioService,
    TarjetaInicioService,
    EquipoMiembroService,
    HistoriaCompletaService,
    SupabaseStorageService,
  ],
})
export class InformacionModule {}
