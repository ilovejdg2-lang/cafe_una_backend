import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaqInicio } from '../entities/faq-inicio.entity';

@Injectable()
export class FaqInicioService {
  constructor(
    @InjectRepository(FaqInicio)
    private readonly repo: Repository<FaqInicio>,
  ) {}

  async obtenerTodos(): Promise<FaqInicio[]> {
    return this.repo.find({
      order: { Orden: 'ASC', Id: 'ASC' },
    });
  }

  async crear(request: {
    Pregunta: string;
    PreguntaEn?: string;
    Respuesta: string;
    RespuestaEn?: string;
    Orden?: number;
  }): Promise<FaqInicio> {
    const pregunta = String(request.Pregunta ?? '').trim();
    const respuesta = String(request.Respuesta ?? '').trim();
    if (!pregunta) {
      throw new BadRequestException('La pregunta es obligatoria.');
    }
    if (!respuesta) {
      throw new BadRequestException('La respuesta es obligatoria.');
    }

    const maxOrden = await this.repo
      .createQueryBuilder('f')
      .select('MAX(f.Orden)', 'max')
      .getRawOne<{ max: number | null }>();

    const item = this.repo.create({
      Pregunta: pregunta.slice(0, 500),
      PreguntaEn: String(request.PreguntaEn ?? '')
        .trim()
        .slice(0, 500),
      Respuesta: respuesta.slice(0, 4000),
      RespuestaEn: String(request.RespuestaEn ?? '')
        .trim()
        .slice(0, 4000),
      Orden: request.Orden ?? (maxOrden?.max ?? 0) + 1,
    });
    return this.repo.save(item);
  }

  async actualizar(
    id: string,
    cambios: {
      Pregunta?: string;
      PreguntaEn?: string;
      Respuesta?: string;
      RespuestaEn?: string;
      Orden?: number;
    },
  ): Promise<FaqInicio | null> {
    const actual = await this.repo.findOne({ where: { Id: id } });
    if (!actual) return null;

    if (cambios.Pregunta != null) {
      const pregunta = String(cambios.Pregunta).trim();
      if (!pregunta) {
        throw new BadRequestException('La pregunta es obligatoria.');
      }
      actual.Pregunta = pregunta.slice(0, 500);
    }
    if (cambios.PreguntaEn != null) {
      actual.PreguntaEn = String(cambios.PreguntaEn).trim().slice(0, 500);
    }
    if (cambios.Respuesta != null) {
      const respuesta = String(cambios.Respuesta).trim();
      if (!respuesta) {
        throw new BadRequestException('La respuesta es obligatoria.');
      }
      actual.Respuesta = respuesta.slice(0, 4000);
    }
    if (cambios.RespuestaEn != null) {
      actual.RespuestaEn = String(cambios.RespuestaEn).trim().slice(0, 4000);
    }
    if (cambios.Orden != null) {
      actual.Orden = Number(cambios.Orden) || 0;
    }

    return this.repo.save(actual);
  }

  async eliminar(id: string): Promise<boolean> {
    const item = await this.repo.findOne({ where: { Id: id } });
    if (!item) return false;
    await this.repo.remove(item);
    return true;
  }
}
