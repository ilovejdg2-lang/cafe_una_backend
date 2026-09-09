import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('fechas_voluntariado')
@Index(['TipoVoluntariado', 'Fecha'], { unique: true })
export class FechaVoluntariado {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'TipoVoluntariado', type: 'varchar', length: 100, default: 'General' })
  TipoVoluntariado: string;

  @Column({ name: 'Fecha', type: 'date' })
  Fecha: string;

  @Column({ name: 'Habilitada', type: 'boolean', default: true })
  Habilitada: boolean;

  @Column({ name: 'Horarios', type: 'jsonb', nullable: true, default: () => "'[]'" })
  Horarios: string[] | null;

  @Column({ name: 'CupoMaximo', type: 'int', nullable: true })
  CupoMaximo: number | null;

  @Column({
    name: 'Observaciones',
    type: 'varchar',
    length: 500,
    default: '',
  })
  Observaciones: string;

  @CreateDateColumn({ name: 'CreatedAt' })
  CreatedAt: Date;

  @UpdateDateColumn({ name: 'UpdatedAt' })
  UpdatedAt: Date;
}
