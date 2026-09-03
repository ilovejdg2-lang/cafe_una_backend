import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { CompraItem } from './compra-item.entity';

@Entity('compras')
export class Compra {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'Numero', type: 'varchar', length: 40, unique: true })
  Numero: string;

  @Column({ name: 'UsuarioId', type: 'int', nullable: true })
  UsuarioId: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'UsuarioId' })
  Usuario?: Usuario | null;

  @Column({ name: 'ClienteNombre', type: 'varchar', length: 150, default: '' })
  ClienteNombre: string;

  @Column({ name: 'ClienteCorreo', type: 'varchar', length: 150, default: '' })
  ClienteCorreo: string;

  @Column({ name: 'Fecha', type: 'timestamptz' })
  Fecha: Date;

  @Column({
    name: 'Subtotal',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  Subtotal: string;

  @Column({
    name: 'Impuestos',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  Impuestos: string;

  @Column({
    name: 'Total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  Total: string;

  @Column({ name: 'MetodoPago', type: 'varchar', length: 50, default: 'Tarjeta' })
  MetodoPago: string;

  @Column({ name: 'Estado', type: 'varchar', length: 40, default: 'Pendiente' })
  Estado: string;

  @Column({ name: 'FacturaId', type: 'varchar', length: 80, nullable: true })
  FacturaId: string | null;

  @OneToMany(() => CompraItem, (item) => item.Compra, { cascade: true })
  Items?: CompraItem[];
}
