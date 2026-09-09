import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { CreateNecesidadDto, UpdateNecesidadDto } from '../dto/necesidad.dto';
import {
  CreateMaterialAceptadoDto,
  UpdateMaterialAceptadoDto,
} from '../dto/donacion-material.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { DonacionMaterialesService } from '../services/donacion-materiales.service';
import { NecesidadesService } from '../services/necesidades.service';

/**
 * Necesidades de donación (DON-P01).
 * Público: GET lista ACTIVA.
 * Admin (JWT): listado completo, alta, edición e inactivación.
 */
@Controller('v1/donaciones/necesidades')
export class NecesidadesController {
  constructor(
    private readonly necesidadesService: NecesidadesService,
    private readonly materialesService: DonacionMaterialesService,
  ) {}

  /** Catálogo público. Sin autenticación. Solo estado ACTIVA. */
  @Get()
  listarPublicas() {
    return this.necesidadesService.listarPublicas();
  }

  /** Listado admin (activas e inactivas). */
  @Get('gestion')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'administrar_solicitudes_donaciones',
    'ver_solicitudes_donacion',
  )
  listarAdmin() {
    return this.necesidadesService.listarAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_donaciones')
  crear(@Body() body: CreateNecesidadDto) {
    return this.necesidadesService.crear((body ?? {}) as unknown as Record<string, unknown>);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'administrar_solicitudes_donaciones',
    'actualizar_solicitud_donaciones',
  )
  actualizar(@Param('id') id: string, @Body() body: UpdateNecesidadDto) {
    return this.necesidadesService.actualizar(
      id,
      (body ?? {}) as unknown as Record<string, unknown>,
    );
  }

  @Patch(':id/inactivar')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'administrar_solicitudes_donaciones',
    'inactivar_donacion',
  )
  inactivar(@Param('id') id: string) {
    return this.necesidadesService.inactivar(id);
  }

  @Get(':id/materiales')
  listarMaterialesPublicos(@Param('id') id: string) {
    return this.materialesService.listarPorCategoria(id, true);
  }

  @Get(':id/materiales/gestion')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'administrar_solicitudes_donaciones',
    'ver_solicitudes_donacion',
  )
  listarMaterialesAdmin(@Param('id') id: string) {
    return this.materialesService.listarPorCategoria(id, false);
  }

  @Post(':id/materiales')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('administrar_solicitudes_donaciones')
  crearMaterial(
    @Param('id') id: string,
    @Body() body: CreateMaterialAceptadoDto,
  ) {
    return this.materialesService.crear(id, (body ?? {}) as unknown as Record<string, unknown>);
  }

  @Put('materiales/:materialId')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'administrar_solicitudes_donaciones',
    'actualizar_solicitud_donaciones',
  )
  actualizarMaterial(
    @Param('materialId') materialId: string,
    @Body() body: UpdateMaterialAceptadoDto,
  ) {
    return this.materialesService.actualizar(
      materialId,
      (body ?? {}) as unknown as Record<string, unknown>,
    );
  }

  @Patch('materiales/:materialId/inactivar')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'administrar_solicitudes_donaciones',
    'inactivar_donacion',
  )
  inactivarMaterial(@Param('materialId') materialId: string) {
    return this.materialesService.inactivar(materialId);
  }
}
