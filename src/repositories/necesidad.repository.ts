import { Injectable } from '@nestjs/common';
import { INecesidadRepository } from './necesidad.repository.interface';

@Injectable()
export class NecesidadRepository implements INecesidadRepository {
  async listarActivas(): Promise<any[]> { return []; }
  async listarTodas(): Promise<any[]> { return []; }
  async crear(datos: any): Promise<any> { return datos; }
  async actualizar(id: any, datos: any): Promise<any> { return datos; }
  async inactivar(id: any): Promise<any> { return { id }; }
}
