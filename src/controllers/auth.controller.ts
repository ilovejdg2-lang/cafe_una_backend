import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { normalizeAuthBody } from '../common/body-fields';
import { MENSAJE_CORREO_NO_ENVIADO } from '../common/respuesta-verificacion';
import { generateToken } from '../common/token-generator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import { UsuariosService } from '../services/usuarios.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() body: Record<string, unknown>) {
    const { identifier, password } = normalizeAuthBody(body);

    if (!identifier.trim() || !password.trim()) {
      throw new BadRequestException('Usuario y contraseña son requeridos.');
    }

    const usuario = await this.authService.autenticar(identifier, password);
    if (!usuario) throw new UnauthorizedException();

    const token = generateToken(
      this.jwtService,
      usuario,
      this.config.get<string>('JWT_SECRET')!,
      this.config.get<string>('JWT_ISSUER')!,
      this.config.get<string>('JWT_AUDIENCE')!,
    );
    return { token };
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(@Req() req: Request & { user: { userId: number } }) {
    const usuario = await this.usuariosService.obtenerPorId(req.user.userId);
    if (!usuario || usuario.Estado.toLowerCase() !== 'activo') {
      throw new UnauthorizedException();
    }

    const token = generateToken(
      this.jwtService,
      usuario,
      this.config.get<string>('JWT_SECRET')!,
      this.config.get<string>('JWT_ISSUER')!,
      this.config.get<string>('JWT_AUDIENCE')!,
    );
    return { token };
  }

  @Post('register')
  async register(@Body() body: Record<string, unknown>) {
    const { nombre, correo, password } = normalizeAuthBody(body);

    try {
      const result = await this.authService.solicitarRegistro({
        Nombre: nombre,
        Correo: correo,
        Password: password,
      });
      if (result.MensajeError) {
        throw new BadRequestException({ message: result.MensajeError });
      }
      return {
        message: result.EmailEnviado
          ? 'Se envió el código de verificación al correo indicado. Revise también la carpeta de spam.'
          : MENSAJE_CORREO_NO_ENVIADO,
        emailSent: result.EmailEnviado,
        requiresVerification: true,
      };
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error de registro.',
      });
    }
  }

  @Post('verify-registration')
  async verifyRegistration(@Body() body: Record<string, unknown>) {
    const { correo, token } = normalizeAuthBody(body);

    try {
      const usuario = await this.authService.confirmarRegistro({
        Correo: correo,
        Token: token,
      });
      return {
        message: 'Cuenta creada correctamente. Ya puede iniciar sesión.',
        id: usuario.Id,
        nombre: usuario.Nombre,
        correo: usuario.Correo,
        estado: usuario.Estado,
        roles: usuario.Roles,
      };
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error de verificación.',
      });
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: Record<string, unknown>) {
    const { identifier } = normalizeAuthBody(body);

    try {
      const result = await this.authService.solicitarRecuperacion({
        Identifier: identifier,
      });
      // Misma respuesta siempre (no enumerar usuarios).
      return {
        message: result.Mensaje,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Error.',
      });
    }
  }

  @Post('reset-password')
  async resetPassword(@Body() body: Record<string, unknown>) {
    const { token, nuevaPassword, identifier } = normalizeAuthBody(body);

    const success = await this.authService.restablecerPassword({
      Token: token,
      NuevaPassword: nuevaPassword,
      Identifier: identifier,
    });
    if (!success) {
      throw new BadRequestException({
        message: 'Token inválido/expirado o contraseña no válida.',
      });
    }
    return { message: 'Contraseña actualizada correctamente.' };
  }
}
