import { JwtService } from '@nestjs/jwt';
import { Usuario } from '../entities/usuario.entity';

export interface JwtPayload {
  sub: string;
  unique_name: string;
  email: string;
  role: string | string[];
}

export function generateToken(
  jwtService: JwtService,
  usuario: Usuario,
  secret: string,
  issuer: string,
  audience: string,
): string {
  const payload: JwtPayload = {
    sub: usuario.Id.toString(),
    unique_name: usuario.Nombre,
    email: usuario.Correo,
    role: usuario.Roles.length === 1 ? usuario.Roles[0] : usuario.Roles,
  };

  return jwtService.sign(payload, {
    secret,
    issuer,
    audience,
    expiresIn: '1h',
  });
}

export function extractRoles(payload: JwtPayload): string[] {
  if (!payload.role) return [];
  return Array.isArray(payload.role) ? payload.role : [payload.role];
}
