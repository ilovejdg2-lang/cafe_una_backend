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
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { TextoInstitucional } from '../entities/texto-institucional.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { EnlaceSitioService } from '../services/enlace-sitio.service';
import { EquipoMiembroService } from '../services/equipo-miembro.service';
import type { EquipoMiembroCambios } from '../services/equipo-miembro.service';
import { FaqInicioService } from '../services/faq-inicio.service';
import { GaleriaInstitucionalService } from '../services/galeria-institucional.service';
import { HeroService } from '../services/hero.service';
import { HistoriaCompletaService } from '../services/historia-completa.service';
import { InformacionFooterService } from '../services/informacion-footer.service';
import { InformacionNavbarService } from '../services/informacion-navbar.service';
import { TarjetaInicioService } from '../services/tarjeta-inicio.service';
import { SupabaseStorageService } from '../services/supabase-storage.service';
import { TextoInstitucionalService } from '../services/texto-institucional.service';

const CARPETA_IMAGENES = 'informacion';
const MAX_IMAGEN_BYTES = 10 * 1024 * 1024;
const MIME_POR_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

@Controller('informacion')
export class InformacionController {
  constructor(
    private readonly heroService: HeroService,
    private readonly textoInstitucionalService: TextoInstitucionalService,
    private readonly galeriaService: GaleriaInstitucionalService,
    private readonly footerService: InformacionFooterService,
    private readonly navbarService: InformacionNavbarService,
    private readonly enlaceSitioService: EnlaceSitioService,
    private readonly faqInicioService: FaqInicioService,
    private readonly tarjetaInicioService: TarjetaInicioService,
    private readonly equipoService: EquipoMiembroService,
    private readonly historiaCompletaService: HistoriaCompletaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  @Get()
  async obtenerInformacion() {
    const [
      hero,
      historia,
      mission,
      vision,
      gallery,
      footer,
      navbar,
      enlaces,
      equipo,
    ] = await Promise.all([
      this.heroService.obtener(),
      this.textoInstitucionalService.obtener('historia'),
      this.textoInstitucionalService.obtener('mission'),
      this.textoInstitucionalService.obtener('vision'),
      this.galeriaService.obtenerTodos(),
      this.footerService.obtener(),
      this.navbarService.obtener(),
      this.enlaceSitioService.obtenerTodos(),
      this.equipoService.obtenerTodos(),
    ]);

    return {
      hero,
      historia,
      mission,
      vision,
      gallery,
      footer,
      navbar,
      enlaces,
      equipo,
    };
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

  @Get('faq-inicio')
  obtenerFaqInicio() {
    return this.faqInicioService.obtenerTodos();
  }

  @Get('equipo')
  obtenerEquipo() {
    return this.equipoService.obtenerTodos();
  }

  @Post('imagenes')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  @UseInterceptors(
    FileInterceptor('imagen', {
      limits: { fileSize: MAX_IMAGEN_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!MIME_POR_EXT[extname(file.originalname ?? '').toLowerCase()]) {
          cb(new BadRequestException('La imagen debe ser JPG, PNG o WEBP.') as unknown as Error, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async subirImagen(
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debés adjuntar una imagen.');
    }
    const ext = extname(file.originalname).toLowerCase();
    const nombre = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    const ok = await this.storage.subirArchivo(
      `${CARPETA_IMAGENES}/${nombre}`,
      file.buffer,
      MIME_POR_EXT[ext],
    );
    if (!ok) throw new BadRequestException('No se pudo subir la imagen.');
    return { url: `/api/informacion/imagenes/${nombre}` };
  }

  @Get('imagenes/:nombre')
  async servirImagen(@Param('nombre') nombre: string) {
    const ext = extname(nombre).toLowerCase();
    if (!/^[A-Za-z0-9._-]+$/.test(nombre) || !MIME_POR_EXT[ext]) {
      throw new BadRequestException('Nombre de imagen inválido.');
    }
    const buffer = await this.storage.descargarBuffer(`${CARPETA_IMAGENES}/${nombre}`);
    if (!buffer) throw new NotFoundException('No se encontró la imagen.');
    return new StreamableFile(buffer, {
      type: MIME_POR_EXT[ext],
      disposition: `inline; filename="${nombre}"`,
    });
  }

  @Get('historia-completa')
  async obtenerHistoriaCompleta() {
    const contenido = await this.historiaCompletaService.obtener();
    if (!contenido) throw new NotFoundException('Todavía no hay historia completa.');
    return contenido;
  }

  @Put('historia-completa')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  guardarHistoriaCompleta(@Body() body: unknown) {
    return this.historiaCompletaService.guardar(body);
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
    @Body() request: { Title: string; Image: string; Categoria?: string; Orden?: number },
  ) {
    return this.galeriaService.crear(request);
  }

  @Put('galeria/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  async actualizarGaleriaItem(
    @Param('id') id: string,
    @Body() cambios: { Title?: string; Image?: string; Categoria?: string; Orden?: number },
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
      EtiquetaEn?: string;
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
      EtiquetaEn?: string;
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

  @Post('faq-inicio')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  crearFaqInicio(
    @Body()
    request: {
      Pregunta: string;
      PreguntaEn?: string;
      Respuesta: string;
      RespuestaEn?: string;
      Icono?: string;
      Orden?: number;
    },
  ) {
    return this.faqInicioService.crear(request);
  }

  @Put('faq-inicio/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  async actualizarFaqInicio(
    @Param('id') id: string,
    @Body()
    cambios: {
      Pregunta?: string;
      PreguntaEn?: string;
      Respuesta?: string;
      RespuestaEn?: string;
      Icono?: string;
      Orden?: number;
    },
  ) {
    const actualizado = await this.faqInicioService.actualizar(id, cambios);
    if (!actualizado) throw new NotFoundException();
    return actualizado;
  }

  @Delete('faq-inicio/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_informacion')
  async eliminarFaqInicio(@Param('id') id: string) {
    const deleted = await this.faqInicioService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }

  @Post('equipo')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  crearMiembroEquipo(@Body() request: EquipoMiembroCambios) {
    return this.equipoService.crear(request);
  }

  @Put('equipo/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('actualizar_informacion')
  async actualizarMiembroEquipo(
    @Param('id') id: string,
    @Body() cambios: EquipoMiembroCambios,
  ) {
    const actualizado = await this.equipoService.actualizar(id, cambios);
    if (!actualizado) throw new NotFoundException();
    return actualizado;
  }

  @Delete('equipo/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_informacion')
  async eliminarMiembroEquipo(@Param('id') id: string) {
    const deleted = await this.equipoService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
