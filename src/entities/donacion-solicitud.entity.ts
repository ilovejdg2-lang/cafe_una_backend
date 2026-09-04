import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DonacionNecesidad } from './donacion-necesidad.entity';
import { Usuario } from './usuario.entity';

export const ESTADOS_SOLICITUD_DONACION = [
  'Pendiente',
  'Aceptada',
  'Rechazada',
] as const;
export type EstadoSolicitudDonacion =
  (typeof ESTADOS_SOLICITUD_DONACION)[number];

@Entity('donacion_solicitudes')
export class DonacionSolicitud {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'UsuarioId', type: 'integer' })
  UsuarioId: number;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'UsuarioId', referencedColumnName: 'Id' })
  Usuario?: Usuario;

  @Column({ name: 'NecesidadId', type: 'integer', nullable: true })
  NecesidadId: number | null;

  @ManyToOne(() => DonacionNecesidad, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'NecesidadId', referencedColumnName: 'Id' })
  Necesidad?: DonacionNecesidad | null;

  @Column({ name: 'Tipo', type: 'varchar', length: 200 })
  Tipo: string;

  @Column({ name: 'Descripcion', type: 'varchar', length: 2000 })
  Descripcion: string;

  @Column({ name: 'FechaPropuesta', type: 'date' })
  FechaPropuesta: string;

  @Column({ name: 'Detalles', type: 'jsonb', nullable: true })
  Detalles: Record<string, unknown> | null;

  @Column({ name: 'Estado', type: 'varchar', length: 20, default: 'Pendiente' })
  Estado: EstadoSolicitudDonacion;

  @CreateDateColumn({ name: 'CreatedAt', type: 'timestamptz' })
  CreatedAt: Date;
}
