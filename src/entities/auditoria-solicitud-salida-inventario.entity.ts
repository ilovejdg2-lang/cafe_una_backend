import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SolicitudSalidaInventario } from './solicitud-salida-inventario.entity';

@Entity('auditoria_solicitud_salida_inventario')
@Index('IDX_auditoria_solicitud_salida_fecha', ['SolicitudId', 'CreadaEn'])
export class AuditoriaSolicitudSalidaInventario {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'SolicitudId', type: 'bigint' })
  SolicitudId: string;

  @Column({ name: 'Accion', type: 'varchar', length: 16 })
  Accion: string;

  @Column({
    name: 'EstadoAnterior',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  EstadoAnterior: string | null;

  @Column({ name: 'EstadoNuevo', type: 'varchar', length: 16 })
  EstadoNuevo: string;

  @Column({ name: 'ActorId', type: 'integer' })
  ActorId: number;

  @Column({ name: 'Comentario', type: 'varchar', length: 500, nullable: true })
  Comentario: string | null;

  @CreateDateColumn({ name: 'CreadaEn', type: 'timestamptz' })
  CreadaEn: Date;

  @ManyToOne(() => SolicitudSalidaInventario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'SolicitudId', referencedColumnName: 'Id' })
  Solicitud?: SolicitudSalidaInventario;
}
