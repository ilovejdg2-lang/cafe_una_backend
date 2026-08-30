import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Bloques de fechas/horas para recibir grupos (visitas o voluntariado). */
@Entity('disponibilidad_grupos')
export class DisponibilidadGrupo {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  /** visitas | voluntariado */
  @Column({ name: 'Tipo', length: 30 })
  Tipo: string;

  @Column({ name: 'Fecha', type: 'date' })
  Fecha: string;

  /** HH:mm — vacío si el día completo está cerrado */
  @Column({ name: 'HoraInicio', length: 5, default: '' })
  HoraInicio: string;

  @Column({ name: 'HoraFin', length: 5, default: '' })
  HoraFin: string;

  @Column({ name: 'Disponible', default: true })
  Disponible: boolean;

  @Column({ name: 'CupoMaximo', type: 'int', nullable: true })
  CupoMaximo: number | null;

  @Column({ name: 'Nota', length: 300, default: '' })
  Nota: string;
}
