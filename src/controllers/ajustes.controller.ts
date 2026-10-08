import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { AjustesSistemaService } from '../services/ajustes-sistema.service';
import { CatalogoSistemaService } from '../services/catalogo-sistema.service';
import {
  DisponibilidadGruposService,
  parseUbicacionId,
} from '../services/disponibilidad-grupos.service';
import { PermisosCatalogoService } from '../services/permisos-catalogo.service';

@Controller('ajustes')
export class AjustesController {
  constructor(
    private readonly disponibilidad: DisponibilidadGruposService,
    private readonly permisosCatalogo: PermisosCatalogoService,
    private readonly sistema: AjustesSistemaService,
    private readonly catalogos: CatalogoSistemaService,
  ) {}

  @Get('idioma')
  async obtenerIdioma() {
    const row = await this.sistema.obtener();
    return { idiomaPredeterminado: row.IdiomaPredeterminado };
  }

  @Put('idioma')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos')
  async guardarIdioma(@Body() body: Record<string, unknown>) {
    const row = await this.sistema.actualizarIdioma(
      body.idiomaPredeterminado ?? body.IdiomaPredeterminado ?? body.idioma,
    );
    return { idiomaPredeterminado: row.IdiomaPredeterminado };
  }

  /** Reglas fijas: lun–vie 8–5, sin fines de semana. */
  @Get('disponibilidad/reglas')
  obtenerReglas() {
    return this.disponibilidad.reglasBase();
  }

  /** Calendario resuelto (público). */
  @Get('disponibilidad/publica')
  listarDisponibilidadPublica(
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('ubicacionId') ubicacionId?: string,
  ) {
    return this.disponibilidad.listarPublicos(
      String(tipo || 'compras').toLowerCase(),
      desde,
      hasta,
      parseUbicacionId(ubicacionId),
    );
  }

  @Get('disponibilidad')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos', 'actualizar_visitas')
  async listarDisponibilidad(
    @Query('tipo') tipo?: string,
    @Query('ubicacionId') ubicacionId?: string,
  ) {
    const excepciones = await this.disponibilidad.listarExcepciones(
      tipo?.toLowerCase(),
      parseUbicacionId(ubicacionId),
    );
    return {
      reglas: this.disponibilidad.reglasBase(),
      excepciones,
    };
  }

  @Post('disponibilidad')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos', 'actualizar_visitas')
  crearDisponibilidad(@Body() body: Record<string, unknown>) {
    return this.disponibilidad.upsertExcepcion(body);
  }

  @Put('disponibilidad/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos', 'actualizar_visitas')
  actualizarDisponibilidad(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.disponibilidad.actualizar(id, body);
  }

  @Delete('disponibilidad/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos', 'actualizar_visitas')
  async eliminarDisponibilidad(@Param('id', ParseIntPipe) id: number) {
    await this.disponibilidad.eliminar(id);
    return { ok: true };
  }

  @Delete('disponibilidad')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos', 'actualizar_visitas')
  async eliminarPorFecha(
    @Query('tipo') tipo?: string,
    @Query('fecha') fecha?: string,
    @Query('ubicacionId') ubicacionId?: string,
  ) {
    await this.disponibilidad.eliminarPorFecha(
      String(tipo || ''),
      String(fecha || ''),
      parseUbicacionId(ubicacionId),
    );
    return { ok: true };
  }

  @Get('catalogos/:tipo')
  listarCatalogo(@Param('tipo') tipo: string) {
    return this.catalogos.listar(tipo);
  }

  @Post('catalogos')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos')
  crearItemCatalogo(@Body() body: Record<string, unknown>) {
    return this.catalogos.crear(body);
  }

  @Put('catalogos/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos')
  actualizarItemCatalogo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.catalogos.actualizar(id, body);
  }

  @Delete('catalogos/:id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos')
  async eliminarItemCatalogo(@Param('id', ParseIntPipe) id: number) {
    await this.catalogos.eliminar(id);
    return { ok: true };
  }

  @Get('permisos')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos')
  obtenerMatriz() {
    return this.permisosCatalogo.obtenerMatrizEditable();
  }

  @Put('permisos')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_roles_permisos')
  guardarMatriz(@Body() body: { matriz?: Record<string, string[]> }) {
    return this.permisosCatalogo.guardarMatriz(body?.matriz ?? {});
  }
}
