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
} from '@nestjs/common';
import { esSuperAdmin } from '../common/usuario-validacion';
import { ProductosService } from './productos.service';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  obtenerProductos() {
    return this.productosService.obtenerTodos();
  }

  @Post()
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
  async eliminarProducto(
    @Param('id') id: string,
    @Body() request?: { ActorRoles?: string[] },
  ) {
    if (!esSuperAdmin(request?.ActorRoles)) {
      throw new BadRequestException({
        message: 'Solo SuperAdmin puede eliminar productos.',
      });
    }
    const deleted = await this.productosService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
