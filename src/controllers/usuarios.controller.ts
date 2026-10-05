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
import { AsignacionesPuntoVentaService } from '../services/asignaciones-punto-venta.service';
import { UsuariosAdminService } from '../services/usuarios-admin.service';
import { UsuariosService } from '../services/usuarios.service';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly perfilService: PerfilService,
    private readonly usuariosAdminService: UsuariosAdminService,
    private readonly asignacionesPunto: AsignacionesPuntoVentaService,
  ) {}

  @Get()
  @RequierePermiso('editar_usuarios', 'gestionar_asignaciones_puntos')
  obtenerUsuarios() {
    return this.usuariosService.obtenerTodos();
  }

  @Get('activos')
  @RequierePermiso('editar_usuarios')
  obtenerUsuariosActivos() {
    return this.usuariosService.obtenerActivos();
  }

  @Get('asignaciones-puntos/elegibles')
  @RequierePermiso('gestionar_asignaciones_puntos')
  listarPuntosElegibles() {
    return this.asignacionesPunto.listarPuntosElegibles();
  }

  @Get(':id/asignaciones-puntos')
  @RequierePermiso('gestionar_asignaciones_puntos')
  listarAsignaciones(@Param('id', ParseIntPipe) id: number) {
    return this.asignacionesPunto.listarDeVendedor(id);
  }

  @Post(':id/asignaciones-puntos')
  @RequierePermiso('gestionar_asignaciones_puntos')
  asignarPuntos(
    @Req() req: Request & { user: JwtUsuario },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { ubicacionIds?: number[]; ubicacionId?: number },
  ) {
    const ids = Array.isArray(body?.ubicacionIds)
      ? body.ubicacionIds
      : body?.ubicacionId != null
        ? [body.ubicacionId]
        : [];
    return this.asignacionesPunto.asignarVarios(id, ids, req.user?.userId ?? null);
  }

  @Patch(':id/asignaciones-puntos/:ubicacionId')
  @RequierePermiso('gestionar_asignaciones_puntos')
  cambiarEstadoAsignacion(
    @Req() req: Request & { user: JwtUsuario },
    @Param('id', ParseIntPipe) id: number,
    @Param('ubicacionId', ParseIntPipe) ubicacionId: number,
    @Body() body: { activo?: boolean },
  ) {
    return this.asignacionesPunto.cambiarEstado(
      id,
      ubicacionId,
      body?.activo === true,
      req.user?.userId ?? null,
    );
  }

  @Post(':id/asignaciones-puntos/cambiar')
  @RequierePermiso('gestionar_asignaciones_puntos')
  cambiarPuntoAsignado(
    @Req() req: Request & { user: JwtUsuario },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { desdeUbicacionId?: number; haciaUbicacionId?: number },
  ) {
    return this.asignacionesPunto.cambiarPunto(
      id,
      Number(body?.desdeUbicacionId),
      Number(body?.haciaUbicacionId),
      req.user?.userId ?? null,
    );
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
    const usuario = await this.usuariosService.obtenerPorIdConCliente(id);
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
    const usuario = await this.usuariosService.obtenerPorIdConCliente(id);
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
      DatosCliente?: Record<string, unknown>;
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
        DatosCliente: cambios.DatosCliente,
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
