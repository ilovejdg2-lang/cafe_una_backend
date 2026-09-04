import {
  DonacionNecesidad,
  EstadoNecesidad,
  PrioridadNecesidad,
} from '../entities/donacion-necesidad.entity';

export type DatosNuevaNecesidad = {
  titulo: string;
  descripcion: string;
  prioridad: PrioridadNecesidad;
  cantidadRequerida: number | null;
};

export type DatosActualizarNecesidad = Partial<DatosNuevaNecesidad> & {
  estado?: EstadoNecesidad;
};

export interface INecesidadRepository {
  listarActivas(): Promise<DonacionNecesidad[]>;
  listarTodas(): Promise<DonacionNecesidad[]>;
  obtenerPorId(id: number): Promise<DonacionNecesidad | null>;
  obtenerPorUuid(uuid: string): Promise<DonacionNecesidad | null>;
  crear(datos: DatosNuevaNecesidad): Promise<DonacionNecesidad>;
  actualizar(
    id: number,
    datos: DatosActualizarNecesidad,
  ): Promise<DonacionNecesidad | null>;
  inactivar(id: number): Promise<DonacionNecesidad | null>;
}

export const NECESIDAD_REPOSITORY = 'INecesidadRepository';
