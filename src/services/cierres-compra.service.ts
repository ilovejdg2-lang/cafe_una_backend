import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  IsNull,
  MoreThanOrEqual,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { hoyIsoEnZona } from '../common/timezone.util';
import { CierreCompra } from '../entities/cierre-compra.entity';
import { InventarioUbicacion } from '../entities/inventario-ubicacion.entity';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTA_MAX = 300;
const PG_UNIQUE_VIOLATION = '23505';
const PG_UNDEFINED_TABLE = '42P01';

export type CierreCompraDto = {
  Id: number;
  Fecha: string;
  Nota: string;
  UbicacionId: number | null;
};

function codigoPg(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return (error.driverError as { code?: string } | undefined)?.code;
}

function esFechaReal(fecha: string): boolean {
  if (!FECHA_RE.test(fecha)) return false;
  const [y, m, d] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** Fechas en las que no se recogen pedidos (feriados, cierres). */
@Injectable()
export class CierresCompraService {
  private readonly logger = new Logger(CierresCompraService.name);

  constructor(
    @InjectRepository(CierreCompra)
    private readonly repo: Repository<CierreCompra>,
    @InjectRepository(InventarioUbicacion)
    private readonly ubicaciones: Repository<InventarioUbicacion>,
  ) {}

  /**
   * Cierres de hoy en adelante (zona horaria de Costa Rica). Sin punto de venta
   * solo los generales; con punto, los generales y los de ese punto, donde el
   * del punto manda si comparten fecha. Si la tabla aún no existe responde []
   * para no romper el checkout.
   */
  async listarPublicos(ubicacionId: number | null): Promise<CierreCompraDto[]> {
    const desde = MoreThanOrEqual(hoyIsoEnZona());
    const where: FindOptionsWhere<CierreCompra>[] = [
      { Fecha: desde, UbicacionId: IsNull() },
    ];
    if (ubicacionId) where.push({ Fecha: desde, UbicacionId: ubicacionId });

    let filas: CierreCompra[];
    try {
      filas = await this.repo.find({
        where,
        order: { Fecha: 'ASC', Id: 'ASC' },
      });
    } catch (error) {
      if (codigoPg(error) === PG_UNDEFINED_TABLE) {
        this.logger.warn(
          'La tabla cierres_compra no existe; ejecute la migración CierresCompra20261106010000.',
        );
        return [];
      }
      throw error;
    }

    const porFecha = new Map<string, CierreCompra>();
    for (const fila of filas) {
      const fecha = String(fila.Fecha).slice(0, 10);
      if (fila.UbicacionId == null && porFecha.has(fecha)) continue;
      porFecha.set(fecha, fila);
    }
    return [...porFecha.values()].map((fila) => this.aDto(fila));
  }

  async listarAdmin(): Promise<CierreCompraDto[]> {
    const filas = await this.repo.find({ order: { Fecha: 'ASC', Id: 'ASC' } });
    return filas.map((fila) => this.aDto(fila));
  }

  async crear(body: Record<string, unknown>): Promise<CierreCompraDto> {
    const fecha = this.validarFecha(body.fecha ?? body.Fecha);
    const nota = this.validarNota(body.nota ?? body.Nota);
    const ubicacionId = await this.validarUbicacion(
      body.ubicacionId ?? body.UbicacionId,
    );

    const existente = await this.repo.findOne({
      where: { Fecha: fecha, UbicacionId: ubicacionId ?? IsNull() },
    });
    if (existente) throw this.duplicado();

    try {
      const guardado = await this.repo.save(
        this.repo.create({
          Fecha: fecha,
          Nota: nota,
          UbicacionId: ubicacionId,
        }),
      );
      return this.aDto(guardado);
    } catch (error) {
      if (codigoPg(error) === PG_UNIQUE_VIOLATION) throw this.duplicado();
      throw error;
    }
  }

  async eliminar(id: number): Promise<void> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) {
      throw new NotFoundException('Fecha sin retiro no encontrada.');
    }
    await this.repo.remove(actual);
  }

  private duplicado(): ConflictException {
    return new ConflictException(
      'Ya existe una fecha sin retiro para ese día y punto de venta.',
    );
  }

  private validarFecha(raw: unknown): string {
    if (typeof raw !== 'string' || !esFechaReal(raw)) {
      throw new BadRequestException('Fecha inválida (use AAAA-MM-DD).');
    }
    if (raw < hoyIsoEnZona()) {
      throw new BadRequestException('La fecha ya pasó.');
    }
    return raw;
  }

  private validarNota(raw: unknown): string {
    if (raw == null) return '';
    if (typeof raw !== 'string') {
      throw new BadRequestException('El motivo debe ser texto.');
    }
    const nota = raw.trim();
    if (nota.length > NOTA_MAX) {
      throw new BadRequestException(
        `El motivo no puede superar ${NOTA_MAX} caracteres.`,
      );
    }
    return nota;
  }

  private async validarUbicacion(raw: unknown): Promise<number | null> {
    if (raw == null || raw === '') return null;
    const id = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(
        'El punto de venta debe ser un número entero positivo o vacío.',
      );
    }
    const punto = await this.ubicaciones.findOne({
      where: { Id: id, Activo: true },
    });
    if (!punto) {
      throw new BadRequestException(
        'El punto de venta no existe o está inactivo.',
      );
    }
    return id;
  }

  private aDto(fila: CierreCompra): CierreCompraDto {
    return {
      Id: fila.Id,
      Fecha: String(fila.Fecha).slice(0, 10),
      Nota: fila.Nota ?? '',
      UbicacionId: fila.UbicacionId ?? null,
    };
  }
}
