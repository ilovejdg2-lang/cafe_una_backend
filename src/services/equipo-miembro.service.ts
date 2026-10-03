import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipoMiembro } from '../entities/equipo-miembro.entity';

export type EquipoMiembroCambios = {
  Nombre?: string;
  Cargo?: string;
  CargoEn?: string;
  Correo?: string;
  Telefono?: string;
  Foto?: string;
  Orden?: number;
};

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(valor: unknown, max: number): string {
  return String(valor ?? '')
    .trim()
    .slice(0, max);
}

function correo(valor: unknown): string {
  const limpio = texto(valor, 200);
  if (limpio && !CORREO_VALIDO.test(limpio)) {
    throw new BadRequestException('El correo no es válido.');
  }
  return limpio;
}

function requerido(valor: unknown, max: number, mensaje: string): string {
  const limpio = texto(valor, max);
  if (!limpio) throw new BadRequestException(mensaje);
  return limpio;
}

@Injectable()
export class EquipoMiembroService {
  constructor(
    @InjectRepository(EquipoMiembro)
    private readonly repo: Repository<EquipoMiembro>,
  ) {}

  async obtenerTodos(): Promise<EquipoMiembro[]> {
    return this.repo.find({
      order: { Orden: 'ASC', Id: 'ASC' },
    });
  }

  async crear(request: EquipoMiembroCambios): Promise<EquipoMiembro> {
    const maxOrden = await this.repo
      .createQueryBuilder('e')
      .select('MAX(e.Orden)', 'max')
      .getRawOne<{ max: number | null }>();

    const item = this.repo.create({
      Nombre: requerido(request.Nombre, 200, 'El nombre es obligatorio.'),
      Cargo: requerido(request.Cargo, 200, 'El cargo es obligatorio.'),
      CargoEn: texto(request.CargoEn, 200),
      Correo: correo(request.Correo),
      Telefono: texto(request.Telefono, 50),
      Foto: texto(request.Foto, 1000),
      Orden: request.Orden ?? (maxOrden?.max ?? 0) + 1,
    });
    return this.repo.save(item);
  }

  async actualizar(
    id: string,
    cambios: EquipoMiembroCambios,
  ): Promise<EquipoMiembro | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    if (cambios.Nombre != null) {
      actual.Nombre = requerido(cambios.Nombre, 200, 'El nombre es obligatorio.');
    }
    if (cambios.Cargo != null) {
      const cargo = requerido(cambios.Cargo, 200, 'El cargo es obligatorio.');
      if (cargo !== actual.Cargo) actual.CargoEn = '';
      actual.Cargo = cargo;
    }
    if (cambios.CargoEn != null) actual.CargoEn = texto(cambios.CargoEn, 200);
    if (cambios.Correo != null) actual.Correo = correo(cambios.Correo);
    if (cambios.Telefono != null) actual.Telefono = texto(cambios.Telefono, 50);
    if (cambios.Foto != null) actual.Foto = texto(cambios.Foto, 1000);
    if (cambios.Orden != null) actual.Orden = Number(cambios.Orden) || 0;

    return this.repo.save(actual);
  }

  async eliminar(id: string): Promise<boolean> {
    const item = await this.repo.findOne({ where: { Id: id } });
    if (!item) return false;
    await this.repo.remove(item);
    return true;
  }
}
