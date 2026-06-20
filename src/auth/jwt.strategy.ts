import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { extractRoles, JwtPayload } from '../common/token-generator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
      issuer: config.get<string>('JWT_ISSUER'),
      audience: config.get<string>('JWT_AUDIENCE'),
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: Number.parseInt(payload.sub, 10),
      sub: payload.sub,
      unique_name: payload.unique_name,
      email: payload.email,
      roles: extractRoles(payload),
    };
  }
}
