import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InformacionController } from '../controllers/informacion.controller';
import { EnlaceSitio } from '../entities/enlace-sitio.entity';
import { GaleriaInstitucionalItem } from '../entities/galeria-institucional-item.entity';
import { HeroPrincipal } from '../entities/hero-principal.entity';
import { InformacionFooter } from '../entities/informacion-footer.entity';
import { InformacionNavbar } from '../entities/informacion-navbar.entity';
import { TarjetaInicio } from '../entities/tarjeta-inicio.entity';
import { TextoInstitucional } from '../entities/texto-institucional.entity';
import { EnlaceSitioService } from '../services/enlace-sitio.service';
import { GaleriaInstitucionalService } from '../services/galeria-institucional.service';
import { HeroService } from '../services/hero.service';
import { InformacionFooterService } from '../services/informacion-footer.service';
import { InformacionNavbarService } from '../services/informacion-navbar.service';
import { TarjetaInicioService } from '../services/tarjeta-inicio.service';
import { TextoInstitucionalService } from '../services/texto-institucional.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HeroPrincipal,
      TextoInstitucional,
      GaleriaInstitucionalItem,
      InformacionFooter,
      InformacionNavbar,
      EnlaceSitio,
      TarjetaInicio,
    ]),
  ],
  controllers: [InformacionController],
  providers: [
    HeroService,
    TextoInstitucionalService,
    GaleriaInstitucionalService,
    InformacionFooterService,
    InformacionNavbarService,
    EnlaceSitioService,
    TarjetaInicioService,
  ],
})
export class InformacionModule {}
