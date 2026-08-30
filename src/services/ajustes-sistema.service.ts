import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizarIdioma } from '../common/localizar';
import { AjusteSistema } from '../entities/ajuste-sistema.entity';

@Injectable()
export class AjustesSistemaService {
  private readonly singletonId = 1;

  constructor(
    @InjectRepository(AjusteSistema)
    private readonly repo: Repository<AjusteSistema>,
  ) {}

  async obtener(): Promise<AjusteSistema> {
    let row = await this.repo.findOne({ where: { Id: this.singletonId } });
    if (!row) {
      row = await this.repo.save(
        this.repo.create({
          Id: this.singletonId,
          IdiomaPredeterminado: 'es',
        }),
      );
    }
    return { ...row };
  }

  async actualizarIdioma(idioma: unknown): Promise<AjusteSistema> {
    const lang = normalizarIdioma(idioma);
    if (idioma != null && !['es', 'en', 'ES', 'EN'].includes(String(idioma).trim())) {
      throw new BadRequestException('Idioma debe ser es o en.');
    }
    let row = await this.repo.findOne({ where: { Id: this.singletonId } });
    if (!row) {
      row = this.repo.create({ Id: this.singletonId, IdiomaPredeterminado: lang });
    } else {
      row.IdiomaPredeterminado = lang;
    }
    const saved = await this.repo.save(row);
    return { ...saved };
  }
}
