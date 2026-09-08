import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { VentasPresencialesService } from '../services/ventas-presenciales.service';

@Controller('ventas-presenciales')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class VentasPresencialesController {
  constructor(
    private readonly ventasPresencialesService: VentasPresencialesService,
  ) {}

  @Get('puntos')
  @RequierePermiso('registrar_ventas', 'ajustar_stock_ubicaciones', 'ver_inventario')
  listarPuntos() {
    return this.ventasPresencialesService.listarPuntosPermitidos();
  }

  @Post()
  @RequierePermiso('registrar_ventas', 'ajustar_stock_ubicaciones')
  registrar(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.ventasPresencialesService.registrar(
      body ?? {},
      req.user?.userId ?? null,
    );
  }

  @Post('enviar-comprobante')
  @RequierePermiso('registrar_ventas', 'ajustar_stock_ubicaciones', 'ver_inventario')
  enviarComprobante(@Body() body: Record<string, unknown>) {
    return this.ventasPresencialesService.enviarComprobante(body ?? {});
  }
}
