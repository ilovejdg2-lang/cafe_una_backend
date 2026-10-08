import {
  Body,
  Controller,
  Delete,
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
    'crear_documentacion',
    'actualizar_documentacion',
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

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  @RequierePermiso(
    'administrar_roles_permisos',
    'actualizar_productos',
    'actualizar_informacion',
    'actualizar_documentacion',
  )
  actualizar(
    @Param('id') id: string,
    @Body()
    request: { nombre?: string; icono?: string; Nombre?: string; Icono?: string },
  ) {
    const nombre = request.nombre ?? request.Nombre;
    const icono = request.icono ?? request.Icono;
    return this.categoriasService.actualizar(id, {
      nombre: nombre == null ? undefined : String(nombre),
      icono: icono == null ? undefined : String(icono),
    });
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
    'inactivar_documentacion',
    'actualizar_documentacion',
  )
  async eliminar(@Param('id') id: string) {
    const deleted = await this.categoriasService.eliminar(id);
    if (!deleted) throw new NotFoundException();
  }
}
