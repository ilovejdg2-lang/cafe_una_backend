import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { ActivosFijosService } from '../services/activos-fijos.service';

@Controller('activos-fijos')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('ver_inventario')
export class ActivosFijosController {
  constructor(private readonly activosFijosService: ActivosFijosService) {}

  @Get()
  listar(@Query('incluirInactivos') incluirInactivos?: string) {
    const incluir =
      incluirInactivos === 'true' ||
      incluirInactivos === '1' ||
      incluirInactivos === 'si';
    return this.activosFijosService.listar(incluir);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.activosFijosService.obtenerPorId(id);
  }

  @Post()
  @RequierePermiso('agregar_articulo_inventario')
  crear(@Body() body: Record<string, unknown>) {
    return this.activosFijosService.crear(body ?? {});
  }

  @Put(':id')
  @RequierePermiso('actualizar_inventario')
  actualizar(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.activosFijosService.actualizar(id, body ?? {});
  }

  @Put(':id/estado')
  @RequierePermiso('inactivar_articulo_inventario')
  cambiarEstado(
    @Param('id') id: string,
    @Body() body: { activo?: unknown; Activo?: unknown },
  ) {
    const activo = Object.prototype.hasOwnProperty.call(body ?? {}, 'activo')
      ? body.activo
      : body?.Activo;
    return this.activosFijosService.cambiarEstado(id, activo);
  }
}
