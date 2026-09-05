import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('fechas_voluntariado')
export class FechaVoluntariado {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'Fecha', type: 'date', unique: true })
  Fecha: string;

  @Column({ name: 'Habilitada', type: 'boolean', default: true })
  Habilitada: boolean;

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
