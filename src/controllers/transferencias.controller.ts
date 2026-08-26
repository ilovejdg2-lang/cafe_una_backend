import {
  Body,
  Controller,
  Post,
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
