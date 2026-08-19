import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InformacionFooter } from '../entities/informacion-footer.entity';

@Injectable()
export class InformacionFooterService {
  private readonly singletonId = 1;

  constructor(
    @InjectRepository(InformacionFooter)
    private readonly repo: Repository<InformacionFooter>,
  ) {}

  async obtener(): Promise<InformacionFooter> {
    let footer = await this.repo.findOne({ where: { Id: this.singletonId } });
    if (!footer) {
      footer = this.repo.create({ Id: this.singletonId });
      footer = await this.repo.save(footer);
    }
    return { ...footer };
  }

  async actualizar(cambios: Partial<InformacionFooter>): Promise<InformacionFooter> {
    let footer = await this.repo.findOne({ where: { Id: this.singletonId } });
    if (!footer) {
      footer = this.repo.create({ Id: this.singletonId });
    }

    const fields = [
      'LogoUrl',
      'LogoClaroUrl',
      'FraseMarca',
      'Telefono',
      'Correo',
      'FacebookUrl',
      'InstagramUrl',
      'MapsUrl',
      'TextoCopyright',
    ] as const;

    for (const field of fields) {
      if (cambios[field] != null) {
        footer[field] = String(cambios[field]).trim();
      }
    }

    const saved = await this.repo.save(footer);
    return { ...saved };
  }
}
