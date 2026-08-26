import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from '../entities/auditoria.entity';

const MODULO_TABLAS: Record<string, string[]> = {
  usuario: ['usuarios'],
  voluntariado: ['solicitudes_voluntariado'],
  inventario: [
    'inventario_stock_ubicaciones',
    'inventario_ubicaciones',
    'activos_fijos',
  ],
  producto: ['productos', 'categorias'],
  informacion_general: [
    'hero_principal',
    'textos_institucionales',
    'tarjetas_inicio',
    'informacion_navbar',
    'informacion_footer',
    'galeria_institucional',
    'enlaces_sitio',
  ],
  compras: ['compras', 'compra_items'],
};

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly repo: Repository<Auditoria>,
  ) {}

  obtenerTodas(
    query: Record<string, string | undefined> = {},
  ): Promise<Auditoria[]> {
    const qb = this.repo
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.Usuario', 'usuario')
      .orderBy('auditoria.Id', 'DESC');

    if (query.usuario?.trim()) {
      const uid = Number(query.usuario);
      if (Number.isFinite(uid) && uid > 0) {
        qb.andWhere('auditoria.IdUsuario = :usuarioId', { usuarioId: uid });
      } else {
        qb.andWhere('usuario.Nombre ILIKE :usuarioNombre', {
          usuarioNombre: `%${query.usuario.trim()}%`,
        });
      }
    }

    if (query.accion?.trim() && query.accion !== 'todos') {
      qb.andWhere('auditoria.Accion ILIKE :accion', {
        accion: query.accion.trim(),
      });
    }

    if (query.modulo?.trim() && query.modulo !== 'todos') {
      const tablas = MODULO_TABLAS[query.modulo.trim()];
      if (tablas?.length) {
        qb.andWhere('auditoria.Tabla IN (:...tablas)', { tablas });
      } else {
        qb.andWhere('auditoria.Tabla ILIKE :tabla', {
          tabla: query.modulo.trim(),
        });
      }
    }

    if (query.tabla?.trim()) {
      qb.andWhere('auditoria.Tabla ILIKE :tablaExacta', {
        tablaExacta: query.tabla.trim(),
      });
    }

    if (query.desde?.trim()) {
      qb.andWhere('auditoria.Fecha >= :desde', {
        desde: `${query.desde.trim()}T00:00:00.000Z`,
      });
    }
    if (query.hasta?.trim()) {
      qb.andWhere('auditoria.Fecha <= :hasta', {
        hasta: `${query.hasta.trim()}T23:59:59.999Z`,
      });
    }

    const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 2000);
    qb.take(limit);

    return qb.getMany();
  }
}
