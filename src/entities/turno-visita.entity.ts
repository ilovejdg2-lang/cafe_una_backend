import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('turnos_visita')
export class TurnoVisita {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'HoraInicio', type: 'time' })
  HoraInicio: string;

  @Column({ name: 'HoraFin', type: 'time' })
  HoraFin: string;

  @Column({ name: 'CapacidadMaxima', type: 'int', default: 30 })
  CapacidadMaxima: number;

  @Column({ name: 'Habilitado', type: 'boolean', default: true })
  Habilitado: boolean;

  @Column({ name: 'Nota', type: 'varchar', length: 500, nullable: true })
  Nota: string | null;
}
