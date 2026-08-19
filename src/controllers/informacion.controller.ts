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
  UseGuards,
} from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { TextoInstitucional } from '../entities/texto-institucional.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { EnlaceSitioService } from '../services/enlace-sitio.service';
import { GaleriaInstitucionalService } from '../services/galeria-institucional.service';
import { HeroService } from '../services/hero.service';
import { InformacionFooterService } from '../services/informacion-footer.service';
import { InformacionNavbarService } from '../services/informacion-navbar.service';
import { TarjetaInicioService } from '../services/tarjeta-inicio.service';
import { TextoInstitucionalService } from '../services/texto-institucional.service';

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
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
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
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  actualizarNavbar(
    @Body() cambios: { LogoUrl?: string; LogoClaroUrl?: string },
  ) {
    return this.navbarService.actualizar(cambios);
  }

  @Patch('footer')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  actualizarFooter(@Body() cambios: Record<string, string | undefined>) {
    return this.footerService.actualizar(cambios);
  }

  @Patch(':seccion')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
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
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('agregar_imagenes_galeria')
  async crearGaleriaItem(
    @Body() request: { Title: string; Image: string; Orden?: number },
  ) {
    return this.galeriaService.crear(request);
  }

  @Put('galeria/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  async actualizarGaleriaItem(
    @Param('id') id: string,
    @Body() cambios: { Title?: string; Image?: string; Orden?: number },
  ) {
    const actualizado = await this.galeriaService.actualizar(id, cambios);
    if (!actualizado) throw new NotFoundException();
    return actualizado;
  }

  @Delete('galeria/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_informacion')
  async eliminarGaleriaItem(@Param('id') id: string) {
    const deleted = await this.galeriaService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }

  @Post('enlaces')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
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
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
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
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_informacion')
  async eliminarEnlace(@Param('id') id: string) {
    const deleted = await this.enlaceSitioService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
