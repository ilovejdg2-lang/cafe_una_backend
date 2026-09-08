import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/token-generator';
import { UsuariosService } from './usuarios.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usuariosService: UsuariosService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
      issuer: config.get<string>('JWT_ISSUER'),
      audience: config.get<string>('JWT_AUDIENCE'),
    });
  }

  async validate(payload: JwtPayload) {
    const userId = Number.parseInt(payload.sub, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException();
    }

    const usuario = await this.usuariosService.obtenerPorId(userId);
    if (!usuario || (usuario.Estado ?? '').toLowerCase() !== 'activo') {
      throw new UnauthorizedException();
    }

    const roles = Array.isArray(usuario.Roles) ? usuario.Roles : [];
    return {
      userId,
      sub: String(usuario.Id),
      unique_name: usuario.Nombre,
      email: usuario.Correo,
      roles,
    };
  }
}
