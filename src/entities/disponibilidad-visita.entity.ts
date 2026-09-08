import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('disponibilidades_visitas')
@Unique('UQ_disponibilidades_visitas_fecha_horas', [
  'Fecha',
  'HoraInicio',
  'HoraFin',
])
@Check('CK_disponibilidades_visitas_horas', '"HoraFin" > "HoraInicio"')
@Index('IDX_disponibilidades_visitas_fecha_habilitada', ['Fecha', 'Habilitada'])
export class DisponibilidadVisita {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Fecha', type: 'date' })
  Fecha: string;

  @Column({ name: 'HoraInicio', type: 'time' })
  HoraInicio: string;

  @Column({ name: 'HoraFin', type: 'time' })
  HoraFin: string;

  @Column({ name: 'Habilitada', type: 'boolean', default: true })
  Habilitada: boolean;

  @Column({ name: 'Nota', type: 'varchar', length: 500, nullable: true })
  Nota: string | null;
}
