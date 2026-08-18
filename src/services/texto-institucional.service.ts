import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  claveTextoADb,
  claveTextoAFront,
  esClaveTextoValida,
} from '../common/cms-claves';
import { TextoInstitucional } from '../entities/texto-institucional.entity';

@Injectable()
export class TextoInstitucionalService {
  constructor(
    @InjectRepository(TextoInstitucional)
    private readonly repo: Repository<TextoInstitucional>,
  ) {}

  esClaveValida(clave: string): boolean {
    return esClaveTextoValida(clave);
  }

  async obtener(clave: string): Promise<TextoInstitucional | null> {
    if (!this.esClaveValida(clave)) return null;
    const texto = await this.repo.findOne({
      where: { Clave: claveTextoADb(clave) },
    });
    if (!texto) return null;
    return { ...texto, Clave: claveTextoAFront(texto.Clave) };
  }

  async actualizar(
    clave: string,
    cambios: {
      Eyebrow?: string | null;
      Title?: string;
      Description?: string;
      Image?: string | null;
      LinkUrl?: string | null;
      LinkText?: string | null;
    },
  ): Promise<TextoInstitucional | null> {
    if (!this.esClaveValida(clave)) return null;

    const claveDb = claveTextoADb(clave);
    let actual = await this.repo.findOne({ where: { Clave: claveDb } });
    if (!actual) {
      actual = this.repo.create({ Clave: claveDb, Description: '' });
    }

    if (cambios.Title?.trim()) actual.Title = cambios.Title.trim();
    if (cambios.Description?.trim()) actual.Description = cambios.Description.trim();
    if (cambios.Eyebrow != null) {
      actual.Eyebrow = cambios.Eyebrow.trim() ? cambios.Eyebrow.trim() : null;
    }
    if (cambios.Image != null) {
      actual.Image = cambios.Image.trim() ? cambios.Image.trim() : null;
    }
    if (cambios.LinkUrl != null) {
      actual.LinkUrl = cambios.LinkUrl.trim() ? cambios.LinkUrl.trim() : null;
    }
    if (cambios.LinkText != null) {
      actual.LinkText = cambios.LinkText.trim() ? cambios.LinkText.trim() : null;
    }

    const saved = await this.repo.save(actual);
    return { ...saved, Clave: claveTextoAFront(saved.Clave) };
  }
}
