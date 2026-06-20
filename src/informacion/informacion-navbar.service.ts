import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InformacionNavbar } from '../entities/informacion-navbar.entity';

@Injectable()
export class InformacionNavbarService {
  private readonly singletonId = 1;

  constructor(
    @InjectRepository(InformacionNavbar)
    private readonly repo: Repository<InformacionNavbar>,
  ) {}

  async obtener(): Promise<InformacionNavbar> {
    let navbar = await this.repo.findOne({ where: { Id: this.singletonId } });
    if (!navbar) {
      navbar = this.repo.create({ Id: this.singletonId });
      navbar = await this.repo.save(navbar);
    }
    return { ...navbar };
  }

  async actualizar(cambios: {
    LogoUrl?: string | null;
    LogoClaroUrl?: string | null;
  }): Promise<InformacionNavbar> {
    let navbar = await this.repo.findOne({ where: { Id: this.singletonId } });
    if (!navbar) {
      navbar = this.repo.create({ Id: this.singletonId });
    }
    if (cambios.LogoUrl != null) navbar.LogoUrl = cambios.LogoUrl.trim();
    if (cambios.LogoClaroUrl != null) navbar.LogoClaroUrl = cambios.LogoClaroUrl.trim();
    const saved = await this.repo.save(navbar);
    return { ...saved };
  }
}
