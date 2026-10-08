import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogoSistemaItem } from '../entities/catalogo-sistema-item.entity';

export const TIPOS_CATALOGO = [
  'presentacion_producto',
  'unidad_presentacion',
  'estado_articulo_donacion',
  'metodo_pago',
  'icono_sitio',
] as const;

const ICONO_VALIDO = /^[a-z0-9-]{0,60}$/;

function texto(valor: unknown, max: number): string {
  return String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

@Injectable()
export class CatalogoSistemaService {
  constructor(
    @InjectRepository(CatalogoSistemaItem)
    private readonly repo: Repository<CatalogoSistemaItem>,
  ) {}

  normalizarTipo(tipo: unknown): string {
    const valor = String(tipo ?? '').trim().toLowerCase();
    if (!(TIPOS_CATALOGO as readonly string[]).includes(valor)) {
      throw new BadRequestException('Tipo de catálogo no válido.');
    }
    return valor;
  }

  private normalizarIcono(icono: unknown): string {
    const valor = String(icono ?? '').trim().toLowerCase();
    if (!ICONO_VALIDO.test(valor)) {
      throw new BadRequestException('Ícono no válido.');
    }
    return valor;
  }

  listar(tipo: unknown, incluirInactivos = false) {
    const tipoNormalizado = this.normalizarTipo(tipo);
    return this.repo.find({
      where: incluirInactivos
        ? { Tipo: tipoNormalizado }
        : { Tipo: tipoNormalizado, Activo: true },
      order: { Orden: 'ASC', Id: 'ASC' },
    });
  }

  private async asegurarNombreLibre(tipo: string, nombre: string, id?: number) {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.Tipo = :tipo', { tipo })
      .andWhere('LOWER(c.Nombre) = LOWER(:nombre)', { nombre });
    if (id != null) qb.andWhere('c.Id <> :id', { id });
    if (await qb.getCount()) {
      throw new ConflictException('Ya existe una opción con ese nombre.');
    }
  }

  async crear(body: Record<string, unknown>) {
    const tipo = this.normalizarTipo(body.tipo ?? body.Tipo);
    const nombre = texto(body.nombre ?? body.Nombre, 120);
    if (!nombre) throw new BadRequestException('Ingresá el nombre.');
    await this.asegurarNombreLibre(tipo, nombre);
    const max = await this.repo
      .createQueryBuilder('c')
      .select('MAX(c.Orden)', 'max')
      .where('c.Tipo = :tipo', { tipo })
      .getRawOne<{ max: number | null }>();
    return this.repo.save(
      this.repo.create({
        Tipo: tipo,
        Nombre: nombre,
        Icono: this.normalizarIcono(body.icono ?? body.Icono),
        Orden: Number(max?.max ?? 0) + 1,
        Activo: true,
      }),
    );
  }

  async actualizar(id: number, body: Record<string, unknown>) {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) throw new NotFoundException('La opción no existe.');

    const nombreCrudo = body.nombre ?? body.Nombre;
    if (nombreCrudo != null) {
      const nombre = texto(nombreCrudo, 120);
      if (!nombre) throw new BadRequestException('Ingresá el nombre.');
      await this.asegurarNombreLibre(actual.Tipo, nombre, id);
      actual.Nombre = nombre;
    }
    const icono = body.icono ?? body.Icono;
    if (icono != null) actual.Icono = this.normalizarIcono(icono);
    const orden = body.orden ?? body.Orden;
    if (orden != null && Number.isFinite(Number(orden))) {
      actual.Orden = Math.trunc(Number(orden));
    }
    const activo = body.activo ?? body.Activo;
    if (typeof activo === 'boolean') actual.Activo = activo;
    return this.repo.save(actual);
  }

  async eliminar(id: number) {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) throw new NotFoundException('La opción no existe.');
    await this.repo.remove(actual);
  }
}
