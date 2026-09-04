import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { MovimientosService } from '../services/movimientos.service';

@Controller('movimientos')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Get()
  @RequierePermiso('ver_inventario')
  listar(@Query() query: Record<string, string | undefined>) {
    return this.movimientosService.listar(query ?? {});
  }
}
