import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('solicitudes_visitas_grupales')
export class VisitaGrupal {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'UserId', type: 'varchar', length: 100, nullable: true })
  UserId: string | null;

  @Column({ name: 'FechaSolicitud', type: 'varchar', length: 20 })
  FechaSolicitud: string;

  @Column({ name: 'Estado', type: 'varchar', length: 30, default: 'Pendiente' })
  Estado: string;

  // Paso 1: Encargado / Responsable
  @Column({ name: 'EncargadoNombre', type: 'varchar', length: 200 })
  EncargadoNombre: string;

  @Column({ name: 'EncargadoIdentificacion', type: 'varchar', length: 100 })
  EncargadoIdentificacion: string;

  @Column({ name: 'EncargadoEmail', type: 'varchar', length: 200 })
  EncargadoEmail: string;

  @Column({ name: 'EncargadoTelefono', type: 'varchar', length: 50 })
  EncargadoTelefono: string;

  @Column({ name: 'EncargadoInstitucion', type: 'varchar', length: 200, nullable: true })
  EncargadoInstitucion: string | null;

  // Paso 2: Grupo y Procedencia
  @Column({ name: 'TipoVisitante', type: 'varchar', length: 50 })
  TipoVisitante: string;

  @Column({ name: 'PaisProcedencia', type: 'varchar', length: 100, nullable: true })
  PaisProcedencia: string | null;

  @Column({ name: 'CiudadProvincia', type: 'varchar', length: 100 })
  CiudadProvincia: string;

  @Column({ name: 'CantidadVisitantes', type: 'int' })
  CantidadVisitantes: number;

  @Column({ name: 'TipoGrupo', type: 'varchar', length: 100 })
  TipoGrupo: string;

  @Column({ name: 'TipoGrupoOtro', type: 'varchar', length: 200, nullable: true })
  TipoGrupoOtro: string | null;

  // Paso 3: Logística y Programación
  @Column({ name: 'FechaVisita', type: 'varchar', length: 20 })
  FechaVisita: string;

  @Column({ name: 'HoraPreferida', type: 'varchar', length: 100 })
  HoraPreferida: string;

  @Column({ name: 'FechaAlternativa', type: 'varchar', length: 20, nullable: true })
  FechaAlternativa: string | null;

  @Column({ name: 'DuracionEstimada', type: 'varchar', length: 100, nullable: true })
  DuracionEstimada: string | null;

  @Column({ name: 'AreaVisita', type: 'varchar', length: 200, nullable: true })
  AreaVisita: string | null;

  // Paso 4: Motivo y Necesidades Especiales
  @Column({ name: 'MotivoVisita', type: 'varchar', length: 200 })
  MotivoVisita: string;

  @Column({ name: 'MotivoOtro', type: 'varchar', length: 200, nullable: true })
  MotivoOtro: string | null;

  @Column({ name: 'RequiereAccesibilidad', type: 'boolean', default: false })
  RequiereAccesibilidad: boolean;

  @Column({ name: 'RequiereParqueoBus', type: 'boolean', default: false })
  RequiereParqueoBus: boolean;

  @Column({ name: 'RequiereGuia', type: 'boolean', default: false })
  RequiereGuia: boolean;

  @Column({ name: 'Observaciones', type: 'varchar', length: 2000, nullable: true })
  Observaciones: string | null;

  @Column({ name: 'ObservacionesAdmin', type: 'varchar', length: 2000, nullable: true })
  ObservacionesAdmin: string | null;
}
