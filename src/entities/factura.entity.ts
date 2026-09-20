import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Compra } from './compra.entity';
import { FacturaItem } from './factura-item.entity';
import { Usuario } from './usuario.entity';

@Entity('facturas')
export class Factura {
  @PrimaryColumn({ name: 'Id', type: 'varchar', length: 80 })
  Id: string;

  @Column({ name: 'CompraId', type: 'int', nullable: true })
  CompraId: number | null;

  @ManyToOne(() => Compra, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'CompraId', referencedColumnName: 'Id' })
  Compra?: Compra | null;

  @Column({ name: 'UsuarioId', type: 'int', nullable: true })
  UsuarioId: number | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'UsuarioId', referencedColumnName: 'Id' })
  Usuario?: Usuario | null;

  @Column({
    name: 'NumeroConsecutivo',
    type: 'varchar',
    length: 50,
    nullable: true,
    unique: true,
  })
  NumeroConsecutivo: string;

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

  @Column({ name: 'UrlPdf', type: 'varchar', length: 500, nullable: true })
  UrlPdf: string | null;

  @Column({ name: 'ArchivoPdf', type: 'varchar', length: 200, nullable: true })
  ArchivoPdf: string | null;

  @Column({
    name: 'FechaEmision',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  FechaEmision: Date;

  @Column({ name: 'Estado', type: 'varchar', length: 30, default: 'Emitida' })
  Estado: string;

  @Column({ name: 'CreadaEn', type: 'timestamptz', default: () => 'NOW()' })
  CreadaEn: Date;

  @OneToMany(() => FacturaItem, (item) => item.Factura, { cascade: true })
  Items?: FacturaItem[];

  @OneToMany(() => Compra, (compra) => compra.Factura)
  Compras?: Compra[];
}
