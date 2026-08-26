import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { pickString } from '../common/body-fields';
import { ActivoFijo } from '../entities/activo-fijo.entity';

type ActivoBody = Record<string, unknown> | undefined | null;

export type ActivoFijoResponse = {
  id: number;
  codigo: string;
  nombre: string;
  modelo: string;
  numeroSerie: string;
  fechaCompra: string | null;
  valorEnLibro: number;
  codigoProyecto: string;
  nombreCompleto: string;
  descripcionResponsable: string;
  descripcionProyecto: string;
  activo: boolean;
};

@Injectable()
export class ActivosFijosService {
  constructor(
    @InjectRepository(ActivoFijo)
    private readonly activosRepository: Repository<ActivoFijo>,
  ) {}

  async listar(incluirInactivos = false): Promise<ActivoFijoResponse[]> {
    const where = incluirInactivos ? {} : { Activo: true };
    const rows = await this.activosRepository.find({
      where,
      order: { Codigo: 'ASC' },
    });
    return rows.map((row) => this.mapear(row));
  }

  async obtenerPorId(id: string): Promise<ActivoFijoResponse> {
    const row = await this.buscarPorId(id);
    return this.mapear(row);
  }

  async crear(body: ActivoBody): Promise<ActivoFijoResponse> {
    const datos = this.validarPayload(body, { requiereCodigo: true });
    const existente = await this.activosRepository.findOne({
      where: { Codigo: datos.Codigo },
    });
    if (existente) {
      throw new ConflictException('Ya existe un activo con ese código.');
    }

    const creado = await this.activosRepository.save(
      this.activosRepository.create({
        ...datos,
        Activo: true,
      }),
    );
    return this.mapear(creado);
  }

  async actualizar(id: string, body: ActivoBody): Promise<ActivoFijoResponse> {
    const row = await this.buscarPorId(id);
    const datos = this.validarPayload(body, {
      requiereCodigo: false,
      codigoActual: row.Codigo,
    });

    if (datos.Codigo !== row.Codigo) {
      const choque = await this.activosRepository.findOne({
        where: { Codigo: datos.Codigo },
      });
      if (choque && choque.Id !== row.Id) {
        throw new ConflictException('Ya existe un activo con ese código.');
      }
    }

    Object.assign(row, datos);
    const guardado = await this.activosRepository.save(row);
    return this.mapear(guardado);
  }

  async cambiarEstado(id: string, activo: unknown): Promise<ActivoFijoResponse> {
    const row = await this.buscarPorId(id);
    row.Activo = this.validarActivo(activo);
    const guardado = await this.activosRepository.save(row);
    return this.mapear(guardado);
  }

  private async buscarPorId(id: string): Promise<ActivoFijo> {
    if (!/^\d+$/.test(String(id))) {
      throw new BadRequestException('El identificador del activo no es válido.');
    }
    const row = await this.activosRepository.findOne({
      where: { Id: Number(id) },
    });
    if (!row) throw new NotFoundException('El activo fijo no existe.');
    return row;
  }

  private validarPayload(
    body: ActivoBody,
    options: { requiereCodigo: boolean; codigoActual?: string },
  ) {
    const codigoRaw = pickString(body, 'codigo', 'Codigo').trim();
    const codigo =
      codigoRaw ||
      (options.requiereCodigo ? '' : (options.codigoActual ?? ''));
    if (!codigo || codigo.length > 50) {
      throw new BadRequestException(
        'El código es obligatorio y debe tener máximo 50 caracteres.',
      );
    }

    const nombre = pickString(body, 'nombre', 'Nombre').trim();
    if (nombre.length < 2 || nombre.length > 200) {
      throw new BadRequestException(
        'El nombre debe tener entre 2 y 200 caracteres.',
      );
    }

    return {
      Codigo: codigo,
      Nombre: nombre,
      Modelo: this.limitar(
        pickString(body, 'modelo', 'Modelo').trim(),
        100,
        'modelo',
      ),
      NumeroSerie: this.limitar(
        pickString(body, 'numeroSerie', 'NumeroSerie').trim(),
        100,
        'número de serie',
      ),
      FechaCompra: this.validarFecha(
        body?.fechaCompra ?? body?.FechaCompra ?? null,
      ),
      ValorEnLibro: this.validarValor(
        body?.valorEnLibro ?? body?.ValorEnLibro ?? 0,
      ),
      CodigoProyecto: this.limitar(
        pickString(body, 'codigoProyecto', 'CodigoProyecto').trim(),
        50,
        'código de proyecto',
      ),
      NombreCompleto: this.limitar(
        pickString(body, 'nombreCompleto', 'NombreCompleto').trim(),
        150,
        'nombre completo',
      ),
      DescripcionResponsable: this.limitar(
        pickString(
          body,
          'descripcionResponsable',
          'DescripcionResponsable',
        ).trim(),
        200,
        'responsable',
      ),
      DescripcionProyecto: this.limitar(
        pickString(body, 'descripcionProyecto', 'DescripcionProyecto').trim(),
        300,
        'descripción de proyecto',
      ),
    };
  }

  private limitar(valor: string, max: number, etiqueta: string): string {
    if (valor.length > max) {
      throw new BadRequestException(
        `El campo ${etiqueta} no puede superar ${max} caracteres.`,
      );
    }
    return valor;
  }

  private validarFecha(valor: unknown): string | null {
    if (valor === null || valor === undefined || valor === '') return null;
    if (typeof valor !== 'string') {
      throw new BadRequestException('La fecha de compra no es válida.');
    }
    const trimmed = valor.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new BadRequestException(
        'La fecha de compra debe usar el formato AAAA-MM-DD.',
      );
    }
    const parsed = new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('La fecha de compra no es válida.');
    }
    return trimmed;
  }

  private validarValor(valor: unknown): string {
    const numero =
      typeof valor === 'number'
        ? valor
        : typeof valor === 'string' && valor.trim() !== ''
          ? Number(valor)
          : NaN;
    if (!Number.isFinite(numero) || numero < 0 || numero > 999999999999.99) {
      throw new BadRequestException(
        'El valor en libro debe ser un número entre 0 y 999999999999.99.',
      );
    }
    return numero.toFixed(2);
  }

  private validarActivo(activo: unknown): boolean {
    if (typeof activo === 'boolean') return activo;
    if (activo === 'true' || activo === 1 || activo === '1') return true;
    if (activo === 'false' || activo === 0 || activo === '0') return false;
    throw new BadRequestException('El estado activo no es válido.');
  }

  private mapear(row: ActivoFijo): ActivoFijoResponse {
    const fecha =
      row.FechaCompra == null
        ? null
        : typeof row.FechaCompra === 'string'
          ? row.FechaCompra.slice(0, 10)
          : new Date(row.FechaCompra).toISOString().slice(0, 10);

    return {
      id: Number(row.Id),
      codigo: row.Codigo,
      nombre: row.Nombre,
      modelo: row.Modelo || '',
      numeroSerie: row.NumeroSerie || '',
      fechaCompra: fecha,
      valorEnLibro: Number(row.ValorEnLibro) || 0,
      codigoProyecto: row.CodigoProyecto || '',
      nombreCompleto: row.NombreCompleto || '',
      descripcionResponsable: row.DescripcionResponsable || '',
      descripcionProyecto: row.DescripcionProyecto || '',
      activo: row.Activo !== false,
    };
  }
}
