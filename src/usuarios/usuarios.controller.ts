import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { PerfilService } from '../perfil/perfil.service';
import { UsuariosAdminService } from './usuarios-admin.service';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly perfilService: PerfilService,
    private readonly usuariosAdminService: UsuariosAdminService,
  ) {}

  @Get()
  obtenerUsuarios() {
    return this.usuariosService.obtenerTodos();
  }

  @Get('activos')
  obtenerUsuariosActivos() {
    return this.usuariosService.obtenerActivos();
  }

  @Get(':id')
  async obtenerUsuarioPorId(@Param('id', ParseIntPipe) id: number) {
    const usuario = await this.usuariosService.obtenerPorId(id);
    if (!usuario) throw new NotFoundException();
    return usuario;
  }

  @Post('solicitar-creacion')
  async solicitarCreacionUsuario(
    @Body()
    request: {
      Nombre: string;
      Correo: string;
      PasswordHash: string;
      Roles?: string[];
    },
  ) {
    try {
      const result = await this.usuariosAdminService.solicitarCreacionUsuario(request);
      if (result.MensajeError) {
        throw new BadRequestException({ message: result.MensajeError });
      }
      return {
        message: result.EmailEnviado
          ? 'Se envió un código de verificación al correo indicado. Revise también la carpeta de spam.'
          : 'Se generó el código, pero no se pudo enviar el correo. Intente de nuevo en unos minutos.',
        emailSent: result.EmailEnviado,
        requiresVerification: true,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Post('confirmar-creacion')
  async confirmarCreacionUsuario(
    @Body() request: { Correo: string; Token: string },
  ) {
    try {
      const creado = await this.usuariosAdminService.confirmarCreacionUsuario(request);
      return creado;
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Post()
  crearUsuario() {
    throw new BadRequestException({
      message:
        'Debe verificar el correo antes de crear el usuario. Use solicitar-creacion y confirmar-creacion.',
    });
  }

  @Put(':id/solicitar-cambio-correo')
  async solicitarCambioCorreoUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: { NuevoCorreo: string; PasswordActual: string },
  ) {
    try {
      const result = await this.perfilService.solicitarCambioCorreo(
        id,
        request.NuevoCorreo,
        request.PasswordActual,
      );
      if (result.MensajeError) {
        throw new BadRequestException({ message: result.MensajeError });
      }
      return {
        message: result.EmailEnviado
          ? 'Se envió un código de verificación al nuevo correo.'
          : 'Se generó el código, pero no se pudo enviar el correo.',
        emailSent: result.EmailEnviado,
        requiresVerification: true,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Put(':id/confirmar-cambio-correo')
  async confirmarCambioCorreoUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: { NuevoCorreo: string; Token: string },
  ) {
    try {
      await this.perfilService.confirmarCambioCorreo(
        id,
        request.NuevoCorreo,
        request.Token,
      );
      const usuario = await this.usuariosService.obtenerPorId(id);
      if (!usuario) throw new NotFoundException();
      return usuario;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Put(':id')
  async actualizarUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    cambios: {
      Nombre: string;
      Correo: string;
      PasswordHash?: string;
      PasswordActual?: string;
      Estado?: string;
      Roles?: string[];
      ActorId?: number;
      ActorRoles?: string[];
    },
  ) {
    try {
      const actualizado = await this.usuariosService.actualizarConActor(
        id,
        {
          Nombre: cambios.Nombre,
          Correo: cambios.Correo,
          PasswordHash: cambios.PasswordHash,
          Estado: cambios.Estado,
          Roles: cambios.Roles,
        },
        cambios.ActorId,
        cambios.ActorRoles,
        cambios.PasswordActual,
      );
      if (!actualizado) throw new NotFoundException();
      return actualizado;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Patch(':id/estado')
  async toggleEstadoUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    request?: {
      Estado?: string;
      ActorId?: number;
      ActorRoles?: string[];
    },
  ) {
    try {
      const actualizado = await this.usuariosService.toggleEstado(
        id,
        request?.Estado,
        request?.ActorId,
        request?.ActorRoles,
      );
      if (!actualizado) throw new NotFoundException();
      return actualizado;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }
}
