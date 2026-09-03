import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { ComprasService } from '../services/compras.service';

@Controller('compras')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Post()
  @RequierePermiso('comprar_productos', 'registrar_ventas')
  registrar(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.comprasService.registrar(body ?? {}, req.user.userId ?? null);
  }

  @Get('mias')
  @RequierePermiso('ver_historial_compras_propio')
  listarMias(
    @Req() req: Request & { user: JwtUsuario },
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.comprasService.listarPropias(req.user.userId, query);
  }

  @Get()
  @RequierePermiso('ver_historial_compras_clientes', 'ver_ventas')
  listarAdmin(
    @Query() query: Record<string, string | undefined>,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    const roles = (req.user?.roles ?? []).map((r) => String(r).toLowerCase());
    const esAdmin = roles.includes('superadmin') || roles.includes('admin');
    const queryFinal = { ...query };
    if (!esAdmin && req.user?.userId) {
      // El vendedor únicamente ve su propio historial de ventas
      queryFinal.usuarioId = String(req.user.userId);
    }
    return this.comprasService.listar(queryFinal);
  }

  @Get(':id')
  @RequierePermiso(
    'ver_historial_compras_propio',
    'ver_historial_compras_clientes',
    'ver_ventas',
  )
  obtenerDetalle(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUsuario },
  ) {
    return this.comprasService.obtenerDetalleAutorizado(
      id,
      req.user.userId ?? null,
      req.user.roles ?? [],
    );
  }

  @Patch(':id/estado')
  @RequierePermiso('actualizar_ventas', 'registrar_ventas')
  cambiarEstado(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.comprasService.cambiarEstado(
      id,
      body?.estado ?? body?.Estado,
    );
  }
}
