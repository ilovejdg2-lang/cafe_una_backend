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
  'homeFaq',
  'homeDocumentacion',
  'homedocumentacion',
  'productores',
]);

@Injectable()
export class TextoInstitucionalService {
  constructor(
    @InjectRepository(TextoInstitucional)
    private readonly repo: Repository<TextoInstitucional>,
  ) {}

  esClaveValida(clave: string): boolean {
    return CLAVES_VALIDAS.has(clave) || CLAVES_VALIDAS.has(clave.toLowerCase());
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
      eyebrow?: string | null;
      EyebrowEn?: string | null;
      eyebrowEn?: string | null;
      Title?: string;
      title?: string;
      TitleEn?: string | null;
      titleEn?: string | null;
      Description?: string;
      description?: string;
      DescriptionEn?: string | null;
      descriptionEn?: string | null;
      Image?: string | null;
      image?: string | null;
      LinkUrl?: string | null;
      linkUrl?: string | null;
      LinkText?: string | null;
      linkText?: string | null;
      LinkTextEn?: string | null;
      linkTextEn?: string | null;
      SecondaryButtonText?: string | null;
      secondaryButtonText?: string | null;
      SecondaryButtonTextEn?: string | null;
      secondaryButtonTextEn?: string | null;
      SecondaryButtonUrl?: string | null;
      secondaryButtonUrl?: string | null;
      TertiaryButtonText?: string | null;
      tertiaryButtonText?: string | null;
      TertiaryButtonTextEn?: string | null;
      tertiaryButtonTextEn?: string | null;
      TertiaryButtonUrl?: string | null;
      tertiaryButtonUrl?: string | null;
      FooterText?: string | null;
      footerText?: string | null;
      FooterTextEn?: string | null;
      footerTextEn?: string | null;
    },
  ): Promise<TextoInstitucional | null> {
    if (!this.esClaveValida(clave)) return null;

    const claveNormalizada = clave.toLowerCase();
    let actual = await this.repo.findOne({ where: { Clave: claveNormalizada } });
    if (!actual) {
      actual = this.repo.create({ Clave: claveNormalizada });
    }

    const titleVal = cambios.Title ?? cambios.title;
    if (titleVal?.trim()) actual.Title = titleVal.trim();
    const titleEnVal = cambios.TitleEn ?? cambios.titleEn;
    if (titleEnEnVal(titleEnVal)) actual.TitleEn = titleEnVal.trim();

    const descVal = cambios.Description ?? cambios.description;
    if (descVal?.trim()) actual.Description = descVal.trim();
    const descEnVal = cambios.DescriptionEn ?? cambios.descriptionEn;
    if (descEnVal != null) actual.DescriptionEn = descEnVal.trim();

    const setOpcional = (campo: keyof TextoInstitucional, val: string | null | undefined) => {
      if (val !== undefined) {
        (actual as unknown as Record<string, unknown>)[campo] = val && val.trim() ? val.trim() : null;
      }
    };

    setOpcional('Eyebrow', cambios.Eyebrow ?? cambios.eyebrow);
    setOpcional('EyebrowEn', cambios.EyebrowEn ?? cambios.eyebrowEn);
    setOpcional('Image', cambios.Image ?? cambios.image);
    setOpcional('LinkUrl', cambios.LinkUrl ?? cambios.linkUrl);
    setOpcional('LinkText', cambios.LinkText ?? cambios.linkText);
    setOpcional('LinkTextEn', cambios.LinkTextEn ?? cambios.linkTextEn);
    setOpcional('SecondaryButtonText', cambios.SecondaryButtonText ?? cambios.secondaryButtonText);
    setOpcional('SecondaryButtonTextEn', cambios.SecondaryButtonTextEn ?? cambios.secondaryButtonTextEn);
    setOpcional('SecondaryButtonUrl', cambios.SecondaryButtonUrl ?? cambios.secondaryButtonUrl);
    setOpcional('TertiaryButtonText', cambios.TertiaryButtonText ?? cambios.tertiaryButtonText);
    setOpcional('TertiaryButtonTextEn', cambios.TertiaryButtonTextEn ?? cambios.tertiaryButtonTextEn);
    setOpcional('TertiaryButtonUrl', cambios.TertiaryButtonUrl ?? cambios.tertiaryButtonUrl);
    setOpcional('FooterText', cambios.FooterText ?? cambios.footerText);
    setOpcional('FooterTextEn', cambios.FooterTextEn ?? cambios.footerTextEn);

    const saved = await this.repo.save(actual);
    return { ...saved };
  }
}

function titleEnEnVal(val: unknown): val is string {
  return typeof val === 'string';
}
