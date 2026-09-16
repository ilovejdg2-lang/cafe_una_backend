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
  const roles = Array.isArray(usuario.Roles) ? usuario.Roles : [];
  const payload: JwtPayload = {
    sub: usuario.Id.toString(),
    unique_name: usuario.Nombre,
    email: usuario.Correo,
    role: roles.length === 1 ? roles[0] : roles,
  };

  const secretLimpio = secret?.trim();
  if (!secretLimpio || secretLimpio.length < 32) {
    throw new Error('JWT_SECRET inválido al firmar el token.');
  }

  return jwtService.sign(payload, {
    secret: secretLimpio,
    issuer: issuer?.trim() || undefined,
    audience: audience?.trim() || undefined,
    expiresIn: '1h',
  });
}

export function extractRoles(payload: JwtPayload): string[] {
  if (!payload.role) return [];
  return Array.isArray(payload.role) ? payload.role : [payload.role];
}
