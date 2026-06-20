import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnlaceSitio } from '../entities/enlace-sitio.entity';
import { GaleriaInstitucionalItem } from '../entities/galeria-institucional-item.entity';
import { HeroPrincipal } from '../entities/hero-principal.entity';
import { InformacionFooter } from '../entities/informacion-footer.entity';
import { InformacionNavbar } from '../entities/informacion-navbar.entity';
import { TarjetaInicio } from '../entities/tarjeta-inicio.entity';
import { TextoInstitucional } from '../entities/texto-institucional.entity';
import { EnlaceSitioService } from './enlace-sitio.service';
import { GaleriaInstitucionalService } from './galeria-institucional.service';
import { HeroService } from './hero.service';
import { InformacionController } from './informacion.controller';
import { InformacionFooterService } from './informacion-footer.service';
import { InformacionNavbarService } from './informacion-navbar.service';
import { TarjetaInicioService } from './tarjeta-inicio.service';
import { TextoInstitucionalService } from './texto-institucional.service';

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
