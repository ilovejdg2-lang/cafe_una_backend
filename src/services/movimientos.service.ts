import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  esTipoMovimientoCanonico,
  normalizarTipoMovimiento,
  valoresTipoParaFiltro,
} from '../common/movimiento-inventario.util';
import { MovimientoInventario } from '../entities/movimiento-inventario.entity';

export type HistorialMovimientoItem = {
  id: string;
  fecha: string;
  tipo: string;
  productoId: string;
  productoNombre: string;
  cantidad: number;
  ubicacionOrigenId: number | null;
  origenNombre: string;
  ubicacionDestinoId: number | null;
  destinoNombre: string;
  responsableId: number | null;
  responsableNombre: string;
  notas: string;
};

export type HistorialMovimientosResponse = {
  items: HistorialMovimientoItem[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class MovimientosService {
  constructor(
    @InjectRepository(MovimientoInventario)
    private readonly movimientosRepo: Repository<MovimientoInventario>,
  ) {}

  async listar(
    query: Record<string, string | undefined>,
  ): Promise<HistorialMovimientosResponse> {
    const page = this.parsearEntero(this.tomar(query, 'page'), 1, 1, 1_000_000, 'página');
    const limit = this.parsearEntero(
      this.tomar(query, 'limit', 'pageSize'),
      25,
      1,
      5000,
      'límite',
    );

    const qb = this.movimientosRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.Producto', 'producto')
      .leftJoinAndSelect('m.Origen', 'origen')
      .leftJoinAndSelect('m.Destino', 'destino')
      .leftJoinAndSelect('m.Responsable', 'responsable')
      .orderBy('m.Fecha', 'DESC')
      .addOrderBy('m.Id', 'DESC');

    const productoId = (this.tomar(query, 'producto_id', 'productoId') ?? '').trim();
    if (productoId) {
      if (!/^\d+$/.test(productoId)) {
        throw new BadRequestException('El identificador del producto no es válido.');
      }
      qb.andWhere('m.ProductoId = :productoId', { productoId });
    }

    const productoNombre = (this.tomar(query, 'producto') ?? '').trim();
    if (productoNombre && !productoId) {
      qb.andWhere('producto.Nombre ILIKE :productoNombre', {
        productoNombre: `%${this.escaparLike(productoNombre)}%`,
      });
    }

    const tipoRaw = (this.tomar(query, 'tipo', 'Tipo') ?? '').trim();
    if (tipoRaw) {
      const tipo = normalizarTipoMovimiento(tipoRaw);
      if (!tipo) {
        throw new BadRequestException(
          'El tipo debe ser entrada, transferencia, venta_presencial o venta_web.',
        );
      }
      qb.andWhere('m.Tipo IN (:...tipos)', {
        tipos: valoresTipoParaFiltro(tipo),
      });
    }

    const ubicacionRaw = (
      this.tomar(query, 'ubicacion_id', 'ubicacionId') ?? ''
    ).trim();
    if (ubicacionRaw) {
      if (!/^\d+$/.test(ubicacionRaw)) {
        throw new BadRequestException(
          'El identificador de la ubicación no es válido.',
        );
      }
      const ubicacionId = Number(ubicacionRaw);
      qb.andWhere(
        '(m.UbicacionId = :ubicacionId OR m.UbicacionOrigenId = :ubicacionId OR m.UbicacionDestinoId = :ubicacionId)',
        { ubicacionId },
      );
    }

    const fechaDesde = (this.tomar(query, 'fecha_desde', 'fechaDesde') ?? '').trim();
    if (fechaDesde) {
      const desde = this.parsearFechaIso(fechaDesde, 'fecha_desde');
      qb.andWhere('m.Fecha >= :fechaDesde', {
        fechaDesde: `${desde}T00:00:00.000Z`,
      });
    }

    const fechaHasta = (this.tomar(query, 'fecha_hasta', 'fechaHasta') ?? '').trim();
    if (fechaHasta) {
      const hasta = this.parsearFechaIso(fechaHasta, 'fecha_hasta');
      qb.andWhere('m.Fecha < :fechaHasta', {
        fechaHasta: this.siguienteDiaIso(hasta),
      });
    }

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: rows.map((row) => this.mapear(row)),
      total,
      page,
      limit,
    };
  }

  private mapear(row: MovimientoInventario): HistorialMovimientoItem {
    const tipo = normalizarTipoMovimiento(row.Tipo) ?? row.Tipo;
    const responsableJoin = row.Responsable
      ? String(row.Responsable.Nombre || row.Responsable.Correo || '').trim()
      : '';
    return {
      id: String(row.Id),
      fecha:
        row.Fecha instanceof Date
          ? row.Fecha.toISOString()
          : String(row.Fecha ?? ''),
      tipo: esTipoMovimientoCanonico(tipo) ? tipo : String(row.Tipo || ''),
      productoId: String(row.ProductoId),
      productoNombre: String(row.Producto?.Nombre || '').trim(),
      cantidad: Number(row.Cantidad) || 0,
      ubicacionOrigenId: row.UbicacionOrigenId ?? null,
      origenNombre: String(row.Origen?.Nombre || '').trim(),
      ubicacionDestinoId: row.UbicacionDestinoId ?? null,
      destinoNombre: String(row.Destino?.Nombre || '').trim(),
      responsableId: row.ResponsableId ?? null,
      responsableNombre:
        responsableJoin || String(row.ResponsableNombre || '').trim(),
      notas: String(row.Notas || row.Observaciones || '').trim(),
    };
  }

  private tomar(
    query: Record<string, string | undefined>,
    ...claves: string[]
  ): string | undefined {
    for (const clave of claves) {
      const valor = query[clave];
      if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
        return String(valor);
      }
    }
    return undefined;
  }

  private parsearEntero(
    raw: string | undefined,
    defecto: number,
    min: number,
    max: number,
    etiqueta: string,
  ): number {
    if (raw === undefined || raw === '') return defecto;
    if (!/^\d+$/.test(raw)) {
      throw new BadRequestException(`El parámetro ${etiqueta} no es válido.`);
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new BadRequestException(`El parámetro ${etiqueta} no es válido.`);
    }
    return n;
  }

  private parsearFechaIso(value: string, label: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        `El parámetro ${label} debe tener formato YYYY-MM-DD.`,
      );
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`El parámetro ${label} no es una fecha válida.`);
    }
    return value;
  }

  private siguienteDiaIso(yyyyMmDd: string): string {
    const d = new Date(`${yyyyMmDd}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  }

  private escaparLike(valor: string): string {
    return valor.replace(/[\\%_]/g, '\\$&');
  }
}
