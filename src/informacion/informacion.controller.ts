import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { esSuperAdmin } from '../common/usuario-validacion';
import { TextoInstitucional } from '../entities/texto-institucional.entity';
import { EnlaceSitioService } from './enlace-sitio.service';
import { GaleriaInstitucionalService } from './galeria-institucional.service';
import { HeroService } from './hero.service';
import { InformacionFooterService } from './informacion-footer.service';
import { InformacionNavbarService } from './informacion-navbar.service';
import { TarjetaInicioService } from './tarjeta-inicio.service';
import { TextoInstitucionalService } from './texto-institucional.service';

@Controller('informacion')
export class InformacionController {
  constructor(
    private readonly heroService: HeroService,
    private readonly textoInstitucionalService: TextoInstitucionalService,
    private readonly galeriaService: GaleriaInstitucionalService,
    private readonly footerService: InformacionFooterService,
    private readonly navbarService: InformacionNavbarService,
    private readonly enlaceSitioService: EnlaceSitioService,
    private readonly tarjetaInicioService: TarjetaInicioService,
  ) {}

  @Get()
  async obtenerInformacion() {
    const [hero, historia, mission, vision, gallery, footer, navbar, enlaces] =
      await Promise.all([
        this.heroService.obtener(),
        this.textoInstitucionalService.obtener('historia'),
        this.textoInstitucionalService.obtener('mission'),
        this.textoInstitucionalService.obtener('vision'),
        this.galeriaService.obtenerTodos(),
        this.footerService.obtener(),
        this.navbarService.obtener(),
        this.enlaceSitioService.obtenerTodos(),
      ]);

    return { hero, historia, mission, vision, gallery, footer, navbar, enlaces };
  }

  @Get('hero')
  async obtenerHero() {
    return this.heroService.obtener();
  }

  @Get('tarjetas-inicio')
  obtenerTarjetasInicio() {
    return this.tarjetaInicioService.obtenerTodas();
  }

  @Get('navbar')
  obtenerNavbar() {
    return this.navbarService.obtener();
  }

  @Get('footer')
  obtenerFooter() {
    return this.footerService.obtener();
  }

  @Get('enlaces')
  obtenerEnlaces(@Query('seccion') seccion?: string) {
    return this.enlaceSitioService.obtenerTodos(seccion);
  }

  @Get(':seccion')
  async obtenerSeccion(@Param('seccion') seccion: string) {
    if (seccion.toLowerCase() === 'hero') {
      return this.heroService.obtener();
    }
    if (seccion.toLowerCase() === 'gallery') {
      return this.galeriaService.obtenerTodos();
    }
    if (this.textoInstitucionalService.esClaveValida(seccion)) {
      const texto = await this.textoInstitucionalService.obtener(seccion);
      if (!texto) {
        return { Clave: seccion.toLowerCase() } as TextoInstitucional;
      }
      return texto;
    }
    throw new NotFoundException();
  }

  @Patch('tarjetas-inicio')
  actualizarTarjetasInicio(
    @Body()
    request: {
      Tarjetas: {
        Clave: string;
        Etiqueta?: string;
        Titulo?: string;
        Descripcion?: string;
        Ruta?: string | null;
        TextoBoton?: string;
      }[];
    },
  ) {
    return this.tarjetaInicioService.actualizarTodas(request.Tarjetas);
  }

  @Patch('navbar')
  actualizarNavbar(
    @Body() cambios: { LogoUrl?: string; LogoClaroUrl?: string },
  ) {
    return this.navbarService.actualizar(cambios);
  }

  @Patch('footer')
  actualizarFooter(@Body() cambios: Record<string, string | undefined>) {
    return this.footerService.actualizar(cambios);
  }

  @Patch(':seccion')
  async actualizarSeccion(
    @Param('seccion') seccion: string,
    @Body() cambios: Record<string, unknown>,
  ) {
    if (seccion.toLowerCase() === 'hero') {
      const hero = await this.heroService.actualizar(cambios as never);
      return hero;
    }
    if (this.textoInstitucionalService.esClaveValida(seccion)) {
      const texto = await this.textoInstitucionalService.actualizar(
        seccion,
        cambios as never,
      );
      if (!texto) throw new NotFoundException();
      return texto;
    }
    throw new NotFoundException();
  }

  @Post('galeria')
  async crearGaleriaItem(
    @Body() request: { Title: string; Image: string; Orden?: number },
  ) {
    return this.galeriaService.crear(request);
  }

  @Put('galeria/:id')
  async actualizarGaleriaItem(
    @Param('id') id: string,
    @Body() cambios: { Title?: string; Image?: string; Orden?: number },
  ) {
    const actualizado = await this.galeriaService.actualizar(id, cambios);
    if (!actualizado) throw new NotFoundException();
    return actualizado;
  }

  @Delete('galeria/:id')
  async eliminarGaleriaItem(
    @Param('id') id: string,
    @Body() request?: { ActorRoles?: string[] },
  ) {
    if (!esSuperAdmin(request?.ActorRoles)) {
      throw new BadRequestException({
        message: 'Solo SuperAdmin puede eliminar items de la galeria.',
      });
    }
    const deleted = await this.galeriaService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }

  @Post('enlaces')
  crearEnlace(
    @Body()
    request: {
      Etiqueta: string;
      Ruta: string;
      Seccion: string;
      Orden?: number;
      AbrirEnNuevaPestana: boolean;
    },
  ) {
    return this.enlaceSitioService.crear(request);
  }

  @Put('enlaces/:id')
  async actualizarEnlace(
    @Param('id') id: string,
    @Body()
    cambios: {
      Etiqueta?: string;
      Ruta?: string;
      Seccion?: string;
      Orden?: number;
      AbrirEnNuevaPestana?: boolean;
    },
  ) {
    const actualizado = await this.enlaceSitioService.actualizar(id, cambios);
    if (!actualizado) throw new NotFoundException();
    return actualizado;
  }

  @Delete('enlaces/:id')
  async eliminarEnlace(
    @Param('id') id: string,
    @Body() request?: { ActorRoles?: string[] },
  ) {
    if (!esSuperAdmin(request?.ActorRoles)) {
      throw new BadRequestException({
        message: 'Solo SuperAdmin puede eliminar enlaces del sitio.',
      });
    }
    const deleted = await this.enlaceSitioService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
