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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PerfilService } from './perfil.service';
import { UsuariosService } from '../usuarios/usuarios.service';

@Controller('perfil')
@UseGuards(JwtAuthGuard)
export class PerfilController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly perfilService: PerfilService,
  ) {}

  @Get()
  async obtenerPerfil(@Req() req: Request & { user: { userId: number } }) {
    const perfil = await this.usuariosService.obtenerPerfil(req.user.userId);
    if (!perfil) throw new NotFoundException();
    return perfil;
  }

  @Put()
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

  @Put('confirmar-cambio-correo')
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
