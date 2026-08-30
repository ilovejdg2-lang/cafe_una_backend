import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeroPrincipal } from '../entities/hero-principal.entity';

@Injectable()
export class HeroService {
  private readonly singletonId = 1;

  constructor(
    @InjectRepository(HeroPrincipal)
    private readonly repo: Repository<HeroPrincipal>,
  ) {}

  async obtener(): Promise<HeroPrincipal> {
    let hero = await this.repo.findOne({ where: { Id: this.singletonId } });
    if (!hero) {
      hero = this.repo.create({ Id: this.singletonId });
      hero = await this.repo.save(hero);
    }
    return { ...hero };
  }

  async actualizar(cambios: Record<string, unknown>): Promise<HeroPrincipal> {
    let hero = await this.repo.findOne({ where: { Id: this.singletonId } });
    if (!hero) {
      hero = this.repo.create({ Id: this.singletonId });
    }

    const str = (v: unknown) => String(v ?? '').trim();
    if (cambios.Eyebrow != null || cambios.eyebrow != null) {
      hero.Eyebrow = str(cambios.Eyebrow ?? cambios.eyebrow);
    }
    if (cambios.EyebrowEn != null || cambios.eyebrowEn != null) {
      hero.EyebrowEn = str(cambios.EyebrowEn ?? cambios.eyebrowEn);
    }
    if (cambios.Title != null || cambios.title != null) {
      const t = str(cambios.Title ?? cambios.title);
      if (t) hero.Title = t;
    }
    if (cambios.TitleEn != null || cambios.titleEn != null) {
      hero.TitleEn = str(cambios.TitleEn ?? cambios.titleEn);
    }
    if (cambios.Subtitle != null || cambios.subtitle != null) {
      const t = str(cambios.Subtitle ?? cambios.subtitle);
      if (t) hero.Subtitle = t;
    }
    if (cambios.SubtitleEn != null || cambios.subtitleEn != null) {
      hero.SubtitleEn = str(cambios.SubtitleEn ?? cambios.subtitleEn);
    }
    if (cambios.PrimaryButtonText != null || cambios.primaryButtonText != null) {
      hero.PrimaryButtonText = str(
        cambios.PrimaryButtonText ?? cambios.primaryButtonText,
      );
    }
    if (
      cambios.PrimaryButtonTextEn != null ||
      cambios.primaryButtonTextEn != null
    ) {
      hero.PrimaryButtonTextEn = str(
        cambios.PrimaryButtonTextEn ?? cambios.primaryButtonTextEn,
      );
    }
    if (cambios.PrimaryButtonUrl != null || cambios.primaryButtonUrl != null) {
      hero.PrimaryButtonUrl = str(
        cambios.PrimaryButtonUrl ?? cambios.primaryButtonUrl,
      );
    }
    if (cambios.ButtonText != null || cambios.buttonText != null) {
      hero.ButtonText = str(cambios.ButtonText ?? cambios.buttonText);
    }
    if (cambios.ButtonTextEn != null || cambios.buttonTextEn != null) {
      hero.ButtonTextEn = str(cambios.ButtonTextEn ?? cambios.buttonTextEn);
    }
    if (cambios.ButtonUrl != null || cambios.buttonUrl != null) {
      hero.ButtonUrl = str(cambios.ButtonUrl ?? cambios.buttonUrl);
    }
    if (cambios.BackgroundImage != null || cambios.backgroundImage != null) {
      hero.BackgroundImage = str(
        cambios.BackgroundImage ?? cambios.backgroundImage,
      );
    }

    const saved = await this.repo.save(hero);
    return { ...saved };
  }
}
