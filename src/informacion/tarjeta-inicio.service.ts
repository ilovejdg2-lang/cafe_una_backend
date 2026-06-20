import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TarjetaInicio } from '../entities/tarjeta-inicio.entity';

const CLAVES_VALIDAS = new Set(['donaciones', 'visitas', 'voluntariado']);
const ORDEN_POR_CLAVE: Record<string, number> = {
  donaciones: 1,
  visitas: 2,
  voluntariado: 3,
};

@Injectable()
export class TarjetaInicioService {
  constructor(
    @InjectRepository(TarjetaInicio)
    private readonly repo: Repository<TarjetaInicio>,
  ) {}

  async obtenerTodas(): Promise<TarjetaInicio[]> {
    return this.repo.find({ order: { Orden: 'ASC' } });
  }

  async actualizarTodas(
    items: {
      Clave: string;
      Etiqueta?: string;
      Titulo?: string;
      Descripcion?: string;
      Ruta?: string | null;
      TextoBoton?: string;
    }[],
  ): Promise<TarjetaInicio[]> {
    for (const item of items ?? []) {
      if (!item.Clave?.trim()) continue;
      const clave = item.Clave.trim().toLowerCase();
      if (!CLAVES_VALIDAS.has(clave)) continue;

      let actual = await this.repo.findOne({ where: { Clave: clave } });
      if (!actual) {
        actual = this.repo.create({ Clave: clave, Orden: ORDEN_POR_CLAVE[clave] });
        this.repo.merge(actual, {});
      }

      if (item.Etiqueta?.trim()) actual.Etiqueta = item.Etiqueta.trim();
      if (item.Titulo?.trim()) actual.Titulo = item.Titulo.trim();
      if (item.Descripcion?.trim()) actual.Descripcion = item.Descripcion.trim();
      if (item.Ruta != null) {
        actual.Ruta = item.Ruta.trim() ? item.Ruta.trim() : null;
      }
      if (item.TextoBoton != null) actual.TextoBoton = item.TextoBoton.trim();

      await this.repo.save(actual);
    }

    return this.obtenerTodas();
  }
}
