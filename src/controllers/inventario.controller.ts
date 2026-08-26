import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
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

  @Post('ubicaciones')
  @RequierePermiso('ajustar_stock_ubicaciones')
  crearUbicacion(
    @Body()
    body: {
      codigo?: unknown;
      Codigo?: unknown;
      nombre?: unknown;
      Nombre?: unknown;
    },
  ) {
    return this.inventarioService.crearUbicacion(body ?? {});
  }

  @Put('ubicaciones/:locationCode')
  @RequierePermiso('ajustar_stock_ubicaciones')
  actualizarUbicacion(
    @Param('locationCode') locationCode: string,
    @Body()
    body: {
      nombre?: unknown;
      Nombre?: unknown;
      activo?: unknown;
      Activo?: unknown;
    },
  ) {
    return this.inventarioService.actualizarUbicacion(locationCode, body ?? {});
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
  }
}
