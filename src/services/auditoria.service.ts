import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from '../entities/auditoria.entity';

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly repo: Repository<Auditoria>,
  ) {}

  obtenerTodas(): Promise<Auditoria[]> {
    return this.repo.find({
      relations: ['Usuario'],
      order: { Id: 'DESC' },
    });
  }
}
