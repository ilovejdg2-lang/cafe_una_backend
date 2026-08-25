import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Body,
  Put,
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

  @Get('stock')
  obtenerStockPorUbicacion(@Query('locationCode') locationCode: string) {
    return this.inventarioService.obtenerStockPorUbicacion(locationCode);
  }

  @Get('productos/:id/stock')
  async obtenerStockProducto(
    @Param('id') id: string,
    @Query('locationCode') locationCode: string,
  ) {
    const stock = await this.inventarioService.obtenerStockProducto(
      id,
      locationCode,
    );
    if (!stock) throw new NotFoundException();
    return stock;
  }

  @Put('ubicaciones/:locationCode/productos/:productId/stock')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('ajustar_stock_ubicaciones')
  async ajustarStockUbicacion(
    @Param('locationCode') locationCode: string,
    @Param('productId') productId: string,
    @Body()
    request: {
      stock?: unknown;
      Stock?: unknown;
      reason?: unknown;
      Reason?: unknown;
    },
  ) {
    try {
      const stock =
        request && Object.prototype.hasOwnProperty.call(request, 'stock')
          ? request.stock
          : request?.Stock;
      const reason =
        request && Object.prototype.hasOwnProperty.call(request, 'reason')
          ? request.reason
          : request?.Reason;
      const actualizado = await this.inventarioService.ajustarStockUbicacion(
        locationCode,
        productId,
        stock,
        reason,
      );
      if (!actualizado) throw new NotFoundException();
      return actualizado;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw error;
    }
  }
}
