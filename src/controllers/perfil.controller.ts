import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermisosGuard } from '../guards/permisos.guard';
import { RequierePermiso } from '../common/requiere-permiso.decorator';
import { MENSAJE_CORREO_NO_ENVIADO } from '../common/respuesta-verificacion';
import { PerfilService } from '../services/perfil.service';
import { UsuariosService } from '../services/usuarios.service';

@Controller('perfil')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class PerfilController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly perfilService: PerfilService,
  ) {}

  @Get()
  @RequierePermiso('ver_perfil_propio')
  async obtenerPerfil(@Req() req: Request & { user: { userId: number } }) {
    const perfil = await this.usuariosService.obtenerPerfil(req.user.userId);
    if (!perfil) throw new NotFoundException();
    return perfil;
  }

  @Put()
  @RequierePermiso('actualizar_perfil_propio')
  async actualizarPerfil(
    @Req() req: Request & { user: { userId: number } },
    @Body()
    request: {
      Nombre?: string;
      FotoPerfilUrl?: string | null;
      FotoBannerUrl?: string | null;
      FotoPerfilPosicion?: string | null;
      FotoBannerPosicion?: string | null;
    },
  ) {
    try {
      const perfil = await this.usuariosService.actualizarPerfil(
        req.user.userId,
        request,
      );
      if (!perfil) throw new NotFoundException();
      return perfil;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Post('solicitar-cambio-correo')
  @RequierePermiso('actualizar_perfil_propio')
  async solicitarCambioCorreo(
    @Req() req: Request & { user: { userId: number } },
    @Body() request: { NuevoCorreo: string; PasswordActual: string },
  ) {
    try {
      const result = await this.perfilService.solicitarCambioCorreo(
        req.user.userId,
        request.NuevoCorreo,
        request.PasswordActual,
      );
      if (result.MensajeError) {
        throw new BadRequestException({ message: result.MensajeError });
      }
      return {
        message: result.EmailEnviado
          ? 'Se envió un código de verificación al nuevo correo. Revise también la carpeta de spam.'
          : MENSAJE_CORREO_NO_ENVIADO,
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

  @Put('confirmar-cambio-correo')
  @RequierePermiso('actualizar_perfil_propio')
  async confirmarCambioCorreo(
    @Req() req: Request & { user: { userId: number } },
    @Body() request: { NuevoCorreo: string; Token: string },
  ) {
    try {
      return await this.perfilService.confirmarCambioCorreo(
        req.user.userId,
        request.NuevoCorreo,
        request.Token,
      );
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Put('password')
  @RequierePermiso('cambiar_contrasena_propia')
  async cambiarPassword(
    @Req() req: Request & { user: { userId: number } },
    @Body() request: { PasswordActual: string; PasswordNueva: string },
  ) {
    try {
      const actualizado = await this.usuariosService.cambiarPassword(
        req.user.userId,
        request.PasswordActual,
        request.PasswordNueva,
      );
      if (!actualizado) {
        throw new BadRequestException({
          message: 'No se pudo actualizar la contraseña.',
        });
      }
      return { message: 'Contraseña actualizada correctamente.' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }
}
