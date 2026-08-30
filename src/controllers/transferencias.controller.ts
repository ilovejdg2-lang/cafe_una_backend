import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtUsuario } from '../common/permisos';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { InventarioService } from '../services/inventario.service';

@Controller('transferencias')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class TransferenciasController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get()
  @RequierePermiso('ver_inventario')
  listar(
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('ubicacionDestino') ubicacionDestino?: string,
    @Query('ubicacionDestinoId') ubicacionDestinoId?: string,
    @Query('codigo') codigo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inventarioService.listarHistorialTransferencias({
      fechaDesde,
      fechaHasta,
      ubicacionDestino,
      ubicacionDestinoId,
      codigo,
      page,
      pageSize,
    });
  }

  @Post()
  @RequierePermiso('ajustar_stock_ubicaciones')
  crear(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.inventarioService.transferir(
      body ?? {},
      req.user?.userId ?? null,
    );
  }
}
