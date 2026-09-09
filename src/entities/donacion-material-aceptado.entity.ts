import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  DonacionNecesidad,
  ESTADOS_NECESIDAD,
  type EstadoNecesidad,
} from './donacion-necesidad.entity';

@Entity('donacion_materiales_aceptados')
export class DonacionMaterialAceptado {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'NecesidadId', type: 'integer' })
  NecesidadId: number;

  @ManyToOne(() => DonacionNecesidad, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'NecesidadId', referencedColumnName: 'Id' })
  Necesidad?: DonacionNecesidad;

  @Column({ name: 'Nombre', type: 'varchar', length: 200 })
  Nombre: string;

  @Column({ name: 'Descripcion', type: 'varchar', length: 500, default: '' })
  Descripcion: string;

  @Column({ name: 'Estado', type: 'varchar', length: 10, default: 'ACTIVA' })
  Estado: EstadoNecesidad;

  @CreateDateColumn({ name: 'CreatedAt', type: 'timestamptz' })
  CreatedAt: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'timestamptz' })
  UpdatedAt: Date;
}

export { ESTADOS_NECESIDAD };
