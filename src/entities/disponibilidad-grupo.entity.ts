import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Excepciones de horario por fecha (compras de productos, visitas o voluntariado). */
@Entity('disponibilidad_grupos')
export class DisponibilidadGrupo {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  /** compras | visitas | voluntariado */
  @Column({ name: 'Tipo', length: 30 })
  Tipo: string;

  @Column({ name: 'Fecha', type: 'date' })
  Fecha: string;

  /** Punto de venta (inventario_ubicaciones). NULL = horario general de todos los puntos. */
  @Column({ name: 'UbicacionId', type: 'int', nullable: true })
  UbicacionId: number | null;

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
