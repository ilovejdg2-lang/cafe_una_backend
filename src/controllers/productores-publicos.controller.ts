import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { type JwtPayload } from '../common/token-generator';
import { tieneAlgunPermiso } from '../common/permisos';
import { PropuestasProductoresService } from '../services/propuestas-productores.service';
import { UsuariosService } from '../services/usuarios.service';

@Controller('productores')
export class ProductoresPublicosController {
  constructor(
    private readonly propuestas: PropuestasProductoresService,
    private readonly jwt: JwtService,
    private readonly usuarios: UsuariosService,
  ) {}

  @Get()
  listar() {
    return this.propuestas.listarPublicas();
  }

  @Get('imagenes/:filename')
  async imagen(
    @Param('filename') filename: string,
    @Req() req: Request,
  ) {
    if (!/^propuesta-[a-z0-9-]+\.(jpg|png|webp)$/i.test(filename)) {
      throw new NotFoundException('No se encontró la imagen.');
    }
    const identidad = await this.identidad(req);
    const archivo = await this.propuestas.leerImagen(
      filename,
      identidad.userId,
      identidad.esAdmin,
    );
    return new StreamableFile(archivo.buffer, {
      type: archivo.mime,
      disposition: `inline; filename="${filename}"`,
    });
  }

  private async identidad(req: Request): Promise<{ userId: number | null; esAdmin: boolean }> {
    const header = String(req.headers.authorization || '');
    const bearer = header.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : '';
    const token = bearer || String(req.query.token || '').trim();
    if (!token) return { userId: null, esAdmin: false };
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      const userId = Number.parseInt(payload.sub, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        return { userId: null, esAdmin: false };
      }
      const usuario = await this.usuarios.obtenerPorId(userId);
      if (!usuario || (usuario.Estado || '').toLowerCase() !== 'activo') {
        return { userId: null, esAdmin: false };
      }
      return {
        userId,
        esAdmin: tieneAlgunPermiso(usuario.Roles, ['administrar_solicitudes_productores']),
      };
    } catch {
      return { userId: null, esAdmin: false };
    }
  }
}
