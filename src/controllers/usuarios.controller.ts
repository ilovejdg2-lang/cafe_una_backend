import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { respuestaVerificacion } from '../common/respuesta-verificacion';
import { JwtUsuario, tienePermiso } from '../common/permisos';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { PerfilService } from '../services/perfil.service';
import { UsuariosAdminService } from '../services/usuarios-admin.service';
import { UsuariosService } from '../services/usuarios.service';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly perfilService: PerfilService,
    private readonly usuariosAdminService: UsuariosAdminService,
  ) {}

  @Get()
  @RequierePermiso('editar_usuarios')
  obtenerUsuarios() {
    return this.usuariosService.obtenerTodos();
  }

  @Get('activos')
  @RequierePermiso('editar_usuarios')
  obtenerUsuariosActivos() {
    return this.usuariosService.obtenerActivos();
  }

  @Get(':id')
  @RequierePermiso('editar_usuarios', 'ver_perfil_propio')
  async obtenerUsuarioPorId(
    @Req() req: Request & { user: JwtUsuario },
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (req.user.userId !== id && !tienePermiso(req.user.roles, 'editar_usuarios')) {
      throw new ForbiddenException('No tiene permiso para ver este usuario.');
    }
    const usuario = await this.usuariosService.obtenerPorId(id);
    if (!usuario) throw new NotFoundException();
    return usuario;
  }

  @Post('solicitar-creacion')
  @RequierePermiso('crear_usuarios')
  async solicitarCreacionUsuario(
    @Body()
    request: {
      Nombre: string;
      Correo: string;
      PasswordHash: string;
      Roles?: string[];
    },
  ) {
    const result = await this.usuariosAdminService.solicitarCreacionUsuario(request);
    return respuestaVerificacion(result.EmailEnviado, result.MensajeError);
  }

  @Post('confirmar-creacion')
  @RequierePermiso('crear_usuarios')
  confirmarCreacionUsuario(@Body() request: { Correo: string; Token: string }) {
    return this.usuariosAdminService.confirmarCreacionUsuario(request);
  }

  @Post()
  @RequierePermiso('crear_usuarios')
  crearUsuario() {
    throw new BadRequestException({
      message:
        'Debe verificar el correo antes de crear el usuario. Use solicitar-creacion y confirmar-creacion.',
    });
  }

  @Put(':id/solicitar-cambio-correo')
  @RequierePermiso('editar_usuarios')
  async solicitarCambioCorreoUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: { NuevoCorreo: string; PasswordActual: string },
  ) {
    const result = await this.perfilService.solicitarCambioCorreo(
      id,
      request.NuevoCorreo,
      request.PasswordActual,
    );
    return respuestaVerificacion(result.EmailEnviado, result.MensajeError);
  }

  @Put(':id/confirmar-cambio-correo')
  @RequierePermiso('editar_usuarios')
  async confirmarCambioCorreoUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: { NuevoCorreo: string; Token: string },
  ) {
    await this.perfilService.confirmarCambioCorreo(
      id,
      request.NuevoCorreo,
      request.Token,
    );
    const usuario = await this.usuariosService.obtenerPorId(id);
    if (!usuario) throw new NotFoundException();
    return usuario;
  }

  @Put(':id')
  @RequierePermiso('editar_usuarios', 'actualizar_perfil_propio')
  async actualizarUsuario(
    @Req() req: Request & { user: JwtUsuario },
    @Param('id', ParseIntPipe) id: number,
    @Body()
    cambios: {
      Nombre: string;
      Correo: string;
      PasswordHash?: string;
      PasswordActual?: string;
      Estado?: string;
      Roles?: string[];
    },
  ) {
    const actualizado = await this.usuariosService.actualizarConActor(
      id,
      {
        Nombre: cambios.Nombre,
        Correo: cambios.Correo,
        PasswordHash: cambios.PasswordHash,
        Estado: cambios.Estado,
        Roles: cambios.Roles,
      },
      req.user.userId,
      req.user.roles,
      cambios.PasswordActual,
    );
    if (!actualizado) throw new NotFoundException();
    return actualizado;
  }

  @Patch(':id/estado')
  @RequierePermiso('inactivar_usuarios')
  async toggleEstadoUsuario(
    @Req() req: Request & { user: JwtUsuario },
    @Param('id', ParseIntPipe) id: number,
    @Body() request?: { Estado?: string },
  ) {
    const actualizado = await this.usuariosService.toggleEstado(
      id,
      request?.Estado,
      req.user.userId,
      req.user.roles,
    );
    if (!actualizado) throw new NotFoundException();
    return actualizado;
  }
}
