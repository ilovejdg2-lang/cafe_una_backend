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

  async actualizar(cambios: {
    Eyebrow?: string | null;
    Title?: string;
    Subtitle?: string;
    PrimaryButtonText?: string | null;
    PrimaryButtonUrl?: string | null;
    ButtonText?: string | null;
    ButtonUrl?: string | null;
    BackgroundImage?: string | null;
  }): Promise<HeroPrincipal> {
    let hero = await this.repo.findOne({ where: { Id: this.singletonId } });
    if (!hero) {
      hero = this.repo.create({ Id: this.singletonId });
      this.repo.merge(hero, {});
    }

    if (cambios.Eyebrow != null) hero.Eyebrow = cambios.Eyebrow.trim();
    if (cambios.Title?.trim()) hero.Title = cambios.Title.trim();
    if (cambios.Subtitle?.trim()) hero.Subtitle = cambios.Subtitle.trim();
    if (cambios.PrimaryButtonText != null) {
      hero.PrimaryButtonText = cambios.PrimaryButtonText.trim();
    }
    if (cambios.PrimaryButtonUrl != null) {
      hero.PrimaryButtonUrl = cambios.PrimaryButtonUrl.trim();
    }
    if (cambios.ButtonText != null) hero.ButtonText = cambios.ButtonText.trim();
    if (cambios.ButtonUrl != null) hero.ButtonUrl = cambios.ButtonUrl.trim();
    if (cambios.BackgroundImage != null) {
      hero.BackgroundImage = cambios.BackgroundImage.trim();
    }

    const saved = await this.repo.save(hero);
    return { ...saved };
  }
}
