import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { AsignacionesPuntoVentaService } from '../services/asignaciones-punto-venta.service';
import { InventarioService } from '../services/inventario.service';

@Controller('inventario')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class InventarioController {
  constructor(
    private readonly inventarioService: InventarioService,
    private readonly asignaciones: AsignacionesPuntoVentaService,
  ) {}

  @Get('motivos-salida')
  @RequierePermiso('ajustar_stock_ubicaciones')
  listarMotivosSalida() {
    return this.inventarioService.listarMotivosSalida();
  }

  @Post('salidas')
  @RequierePermiso('ajustar_stock_ubicaciones')
  registrarSalida(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.inventarioService.registrarSalida(
      body ?? {},
      req.user.userId ?? null,
    );
  }

  @Get('ubicaciones')
  @RequierePermiso('ver_inventario', 'registrar_ventas')
  async obtenerUbicaciones(@Req() req: Request & { user: JwtUsuario }) {
    const ubicaciones = await this.inventarioService.obtenerUbicaciones();
    return this.asignaciones.filtrarUbicacionesVisibles(req.user, ubicaciones);
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
  @RequierePermiso('ver_inventario', 'registrar_ventas')
  async obtenerStockPorUbicacion(
    @Query('locationCode') locationCode: string,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    await this.asignaciones.exigirConsultaPunto(req.user, locationCode);
    return this.inventarioService.obtenerStockPorUbicacion(locationCode);
  }

  @Get('productos/:id/stock')
  @RequierePermiso('ver_inventario', 'registrar_ventas')
  async obtenerStockProducto(
    @Param('id') id: string,
    @Query('locationCode') locationCode: string,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    if (locationCode) {
      await this.asignaciones.exigirConsultaPunto(req.user, locationCode);
    }
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
