export const NECESIDAD_REPOSITORY = 'NECESIDAD_REPOSITORY';

export interface INecesidadRepository {
  listarActivas(): Promise<any[]>;
  listarTodas(): Promise<any[]>;
  crear(datos: any): Promise<any>;
  actualizar(id: any, datos: any): Promise<any>;
  inactivar(id: any): Promise<any>;
}
