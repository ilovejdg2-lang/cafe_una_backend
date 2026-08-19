import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { ProductosService } from '../services/productos.service';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  obtenerProductos() {
    return this.productosService.obtenerTodos();
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('crear_productos')
  async crearProducto(
    @Body()
    request: {
      Nombre: string;
      Descripcion: string;
      Imagen: string;
      PrecioNormal: number;
      Stock: number;
      Estado?: string;
      Peso: string;
      EsDestacado: boolean;
    },
  ) {
    try {
      return await this.productosService.crear(request);
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'actualizar_productos',
    'actualizar_stock_productos',
    'inactivar_productos',
  )
  async actualizarProducto(
    @Param('id') id: string,
    @Body()
    cambios: {
      Nombre?: string;
      Descripcion?: string;
      Imagen?: string;
      PrecioNormal?: number;
      PrecioConIVA?: number;
      Stock?: number;
      Estado?: string;
      Peso?: string;
      EsDestacado?: boolean;
    },
  ) {
    try {
      const actualizado = await this.productosService.actualizar(id, cambios);
      if (!actualizado) throw new NotFoundException();
      return actualizado;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Post('ajustar-stock')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('comprar_productos', 'actualizar_stock_productos')
  async ajustarStock(
    @Body() items: { Id: number | string; Units: number }[],
  ) {
    try {
      return await this.productosService.ajustarStock(items);
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso('inactivar_productos')
  async eliminarProducto(@Param('id') id: string) {
    const deleted = await this.productosService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
