import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { pickString } from '../common/body-fields';
import { CategoriasService } from '../services/categorias.service';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Get()
  listar(
    @Query('tipo') tipo?: string,
    @Query('padre') padre?: string,
  ) {
    return this.categoriasService.listar(
      tipo,
      padre === undefined ? undefined : padre,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'crear_productos',
    'actualizar_productos',
    'actualizar_informacion',
    'agregar_imagenes_galeria',
  )
  crear(
    @Body()
    request: {
      nombre?: string;
      tipo?: string;
      padre?: string;
      Nombre?: string;
      Tipo?: string;
      Padre?: string;
    },
  ) {
    return this.categoriasService.crear(
      pickString(request, 'nombre', 'Nombre'),
      pickString(request, 'tipo', 'Tipo'),
      pickString(request, 'padre', 'Padre'),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'crear_productos',
    'actualizar_productos',
    'inactivar_productos',
    'actualizar_informacion',
    'agregar_imagenes_galeria',
    'inactivar_informacion',
  )
  async eliminar(@Param('id') id: string) {
    const deleted = await this.categoriasService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
