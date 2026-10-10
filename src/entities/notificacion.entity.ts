import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notificaciones')
@Index('IX_notificaciones_usuario_leida', ['UsuarioId', 'Leida'])
export class Notificacion {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'UsuarioId', type: 'int' })
  UsuarioId: number;

  @Column({ name: 'Tipo', type: 'varchar', length: 40 })
  Tipo: string;

  @Column({ name: 'Titulo', type: 'varchar', length: 160 })
  Titulo: string;

  @Column({ name: 'Mensaje', type: 'varchar', length: 500 })
  Mensaje: string;

  @Column({ name: 'Enlace', type: 'varchar', length: 300 })
  Enlace: string;

  @Column({ name: 'Leida', type: 'boolean', default: false })
  Leida: boolean;

  @Column({ name: 'ClaveUnica', type: 'varchar', length: 120, unique: true })
  ClaveUnica: string;

  @Column({ name: 'ReferenciaId', type: 'varchar', length: 40, nullable: true })
  ReferenciaId: string | null;

  @CreateDateColumn({ name: 'CreadoEn', type: 'timestamptz' })
  CreadoEn: Date;
}
