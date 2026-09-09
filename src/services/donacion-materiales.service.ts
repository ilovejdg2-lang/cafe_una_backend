import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { pickString } from '../common/body-fields';
import { DonacionMaterialAceptado } from '../entities/donacion-material-aceptado.entity';
import { DonacionNecesidad } from '../entities/donacion-necesidad.entity';
import { ESTADOS_NECESIDAD } from '../entities/donacion-necesidad.entity';

function mapearMaterial(row: DonacionMaterialAceptado) {
  return {
    id: row.Id,
    necesidadId: row.NecesidadId,
    nombre: row.Nombre,
    descripcion: row.Descripcion ?? '',
    estado: row.Estado,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

@Injectable()
export class DonacionMaterialesService {
  constructor(
    @InjectRepository(DonacionMaterialAceptado)
    private readonly materiales: Repository<DonacionMaterialAceptado>,
    @InjectRepository(DonacionNecesidad)
    private readonly necesidades: Repository<DonacionNecesidad>,
  ) {}

  async listarPorCategoria(necesidadIdRaw: number | string, soloActivos: boolean) {
    const necesidadId = this.parsearId(String(necesidadIdRaw));
    const categoria = await this.asegurarCategoria(necesidadId);
    if (soloActivos && categoria.Estado !== 'ACTIVA') {
      return [];
    }
    const where: { NecesidadId: number; Estado?: 'ACTIVA' } = {
      NecesidadId: necesidadId,
    };
    if (soloActivos) where.Estado = 'ACTIVA';
    const rows = await this.materiales.find({
      where,
      order: { Nombre: 'ASC' },
    });
    return rows.map(mapearMaterial);
  }

  async listarPorCategorias(ids: number[]) {
    if (!ids.length) return [] as ReturnType<typeof mapearMaterial>[];
    const rows = await this.materiales.find({
      where: { NecesidadId: In(ids) },
      order: { Nombre: 'ASC' },
    });
    return rows.map(mapearMaterial);
  }

  async crear(necesidadIdRaw: string, body: Record<string, unknown>) {
    const necesidadId = this.parsearId(necesidadIdRaw);
    await this.asegurarCategoria(necesidadId);
    const nombre = pickString(body, 'nombre', 'Nombre').trim();
    const descripcion = pickString(body, 'descripcion', 'Descripcion').trim();
    if (!nombre) {
      throw new BadRequestException('El nombre del material es obligatorio.');
    }
    if (nombre.length > 200) {
      throw new BadRequestException('El nombre no puede superar 200 caracteres.');
    }
    const guardado = await this.materiales.save(
      this.materiales.create({
        NecesidadId: necesidadId,
        Nombre: nombre,
        Descripcion: descripcion.slice(0, 500),
        Estado: 'ACTIVA',
      }),
    );
    return mapearMaterial(guardado);
  }

  async actualizar(materialIdRaw: string, body: Record<string, unknown>) {
    const material = await this.obtener(materialIdRaw);
    const nombreRaw = pickString(body, 'nombre', 'Nombre');
    const descripcionRaw = pickString(body, 'descripcion', 'Descripcion');
    const estadoRaw = pickString(body, 'estado', 'Estado').trim().toUpperCase();
    if (nombreRaw.trim()) {
      if (nombreRaw.trim().length > 200) {
        throw new BadRequestException(
          'El nombre no puede superar 200 caracteres.',
        );
      }
      material.Nombre = nombreRaw.trim();
    }
    if (
      Object.prototype.hasOwnProperty.call(body, 'descripcion') ||
      Object.prototype.hasOwnProperty.call(body, 'Descripcion')
    ) {
      material.Descripcion = descripcionRaw.trim().slice(0, 500);
    }
    if (estadoRaw) {
      if (!ESTADOS_NECESIDAD.includes(estadoRaw as (typeof ESTADOS_NECESIDAD)[number])) {
        throw new BadRequestException('El estado debe ser ACTIVA o INACTIVA.');
      }
      material.Estado = estadoRaw as (typeof ESTADOS_NECESIDAD)[number];
    }
    return mapearMaterial(await this.materiales.save(material));
  }

  async inactivar(materialIdRaw: string) {
    const material = await this.obtener(materialIdRaw);
    material.Estado = 'INACTIVA';
    return mapearMaterial(await this.materiales.save(material));
  }

  async obtenerActivoDeCategoria(necesidadId: number, materialId: number) {
    return this.materiales.findOne({
      where: {
        Id: materialId,
        NecesidadId: necesidadId,
        Estado: 'ACTIVA',
      },
    });
  }

  private async obtener(materialIdRaw: string) {
    const id = this.parsearId(materialIdRaw);
    const material = await this.materiales.findOne({ where: { Id: id } });
    if (!material) {
      throw new NotFoundException('El material aceptado no existe.');
    }
    return material;
  }

  private async asegurarCategoria(necesidadId: number) {
    const categoria = await this.necesidades.findOne({
      where: { Id: necesidadId },
    });
    if (!categoria) {
      throw new NotFoundException('La categoría de donación no existe.');
    }
    return categoria;
  }

  private parsearId(raw: string): number {
    if (!/^\d+$/.test(String(raw ?? '').trim())) {
      throw new BadRequestException('El identificador no es válido.');
    }
    return Number(raw);
  }
}
