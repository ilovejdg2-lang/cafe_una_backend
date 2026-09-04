import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PRIORIDADES_NECESIDAD = ['ALTA', 'MEDIA', 'BAJA'] as const;
export type PrioridadNecesidad = (typeof PRIORIDADES_NECESIDAD)[number];

export const ESTADOS_NECESIDAD = ['ACTIVA', 'INACTIVA'] as const;
export type EstadoNecesidad = (typeof ESTADOS_NECESIDAD)[number];

@Entity('donacion_necesidades')
export class DonacionNecesidad {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({
    name: 'Uuid',
    type: 'uuid',
    unique: true,
    default: () => 'gen_random_uuid()',
  })
  Uuid: string;

  @Column({ name: 'Titulo', type: 'varchar', length: 200 })
  Titulo: string;

  @Column({ name: 'Descripcion', type: 'varchar', length: 2000 })
  Descripcion: string;

  @Column({ name: 'Prioridad', type: 'varchar', length: 10 })
  Prioridad: PrioridadNecesidad;

  @Column({ name: 'CantidadRequerida', type: 'integer', nullable: true })
  CantidadRequerida: number | null;

  @Column({ name: 'Estado', type: 'varchar', length: 10, default: 'ACTIVA' })
  Estado: EstadoNecesidad;

  @CreateDateColumn({ name: 'CreatedAt', type: 'timestamptz' })
  CreatedAt: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'timestamptz' })
  UpdatedAt: Date;

  @DeleteDateColumn({ name: 'DeletedAt', type: 'timestamptz', nullable: true })
  DeletedAt: Date | null;
}
