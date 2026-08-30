import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { SolicitudesCompraService } from '../services/solicitudes-compra.service';

@Controller('proveedores')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ProveedoresController {
  constructor(
    private readonly solicitudesCompraService: SolicitudesCompraService,
  ) {}

  @Get()
  @RequierePermiso('ver_inventario')
  listar(@Query('incluirInactivos') incluirInactivos?: string) {
    const incluir =
      incluirInactivos === 'true' ||
      incluirInactivos === '1' ||
      incluirInactivos === 'si';
    return this.solicitudesCompraService.listarProveedores(incluir);
  }

  @Post()
  @RequierePermiso('agregar_productor')
  crear(@Body() body: Record<string, unknown>) {
    return this.solicitudesCompraService.crearProveedor(body ?? {});
  }
}
