import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'Accion', type: 'varchar', length: 50 })
  Accion: string;

  @Column({ name: 'Tabla', type: 'varchar', length: 80 })
  Tabla: string;

  @Column({ name: 'IdRegistro', type: 'varchar', length: 50, nullable: true })
  IdRegistro: string | null;

  @Column({ name: 'Detalle', type: 'varchar', length: 500, default: '' })
  Detalle: string;

  @Column({ name: 'Fecha', type: 'timestamptz' })
  Fecha: Date;

  @Column({ name: 'IdUsuario', type: 'int', nullable: true })
  IdUsuario: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'IdUsuario' })
  Usuario?: Usuario | null;
}
