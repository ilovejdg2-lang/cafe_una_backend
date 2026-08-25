import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { InventarioService } from '../services/inventario.service';

@Controller('inventario')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('ver_inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get('ubicaciones')
  obtenerUbicaciones() {
    return this.inventarioService.obtenerUbicaciones();
  }

  @Get('productos/:id/stock')
  async obtenerStockProducto(
    @Param('id') id: string,
    @Query('locationCode') locationCode?: string,
  ) {
    const stock = await this.inventarioService.obtenerStockProducto(
      id,
      locationCode,
    );
    if (!stock) throw new NotFoundException();
    return stock;
  }
}
