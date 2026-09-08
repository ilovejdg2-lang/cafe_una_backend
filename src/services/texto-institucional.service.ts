import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TextoInstitucional } from '../entities/texto-institucional.entity';

const CLAVES_VALIDAS = new Set([
  'historia',
  'mission',
  'vision',
  'homeSpotlight',
  'homeFeatured',
  'homeIniciativas',
  'homeLocation',
]);

@Injectable()
export class TextoInstitucionalService {
  constructor(
    @InjectRepository(TextoInstitucional)
    private readonly repo: Repository<TextoInstitucional>,
  ) {}

  esClaveValida(clave: string): boolean {
    return CLAVES_VALIDAS.has(clave);
  }

  async obtener(clave: string): Promise<TextoInstitucional | null> {
    if (!this.esClaveValida(clave)) return null;
    const texto = await this.repo.findOne({
      where: { Clave: clave.toLowerCase() },
    });
    return texto ? { ...texto } : null;
  }

  async actualizar(
    clave: string,
    cambios: {
      Eyebrow?: string | null;
      EyebrowEn?: string | null;
      Title?: string;
      TitleEn?: string | null;
      Description?: string;
      DescriptionEn?: string | null;
      Image?: string | null;
      LinkUrl?: string | null;
      LinkText?: string | null;
      LinkTextEn?: string | null;
    },
  ): Promise<TextoInstitucional | null> {
    if (!this.esClaveValida(clave)) return null;

    const claveNormalizada = clave.toLowerCase();
    let actual = await this.repo.findOne({ where: { Clave: claveNormalizada } });
    if (!actual) {
      actual = this.repo.create({ Clave: claveNormalizada });
    }

    if (cambios.Title?.trim()) actual.Title = cambios.Title.trim();
    if (cambios.TitleEn != null) actual.TitleEn = cambios.TitleEn.trim();
    if (cambios.Description?.trim()) actual.Description = cambios.Description.trim();
    if (cambios.DescriptionEn != null) {
      actual.DescriptionEn = cambios.DescriptionEn.trim();
    }
    if (cambios.Eyebrow != null) {
      actual.Eyebrow = cambios.Eyebrow.trim() ? cambios.Eyebrow.trim() : null;
    }
    if (cambios.EyebrowEn != null) {
      actual.EyebrowEn = cambios.EyebrowEn.trim()
        ? cambios.EyebrowEn.trim()
        : null;
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
    if (cambios.LinkTextEn != null) {
      actual.LinkTextEn = cambios.LinkTextEn.trim()
        ? cambios.LinkTextEn.trim()
        : null;
    }

    const saved = await this.repo.save(actual);
    return { ...saved };
  }
}
