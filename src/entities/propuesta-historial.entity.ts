import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Bitácora de revisión: cambios de estado, ediciones y notas. Solo administradores. */
@Entity('propuestas_productores_historial')
@Index('IX_propuestas_historial_propuesta', ['PropuestaId'])
export class PropuestaHistorial {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'PropuestaId', type: 'bigint' })
  PropuestaId: string;

  /** estado | edicion | nota */
  @Column({ name: 'Accion', type: 'varchar', length: 20 })
  Accion: string;

  @Column({ name: 'EstadoAnterior', type: 'varchar', length: 20, nullable: true })
  EstadoAnterior: string | null;

  @Column({ name: 'EstadoNuevo', type: 'varchar', length: 20, nullable: true })
  EstadoNuevo: string | null;

  @Column({ name: 'Comentario', type: 'varchar', length: 2000, nullable: true })
  Comentario: string | null;

  @Column({ name: 'AdminId', type: 'int', nullable: true })
  AdminId: number | null;

  @CreateDateColumn({ name: 'CreadoEn', type: 'timestamptz' })
  CreadoEn: Date;
}
