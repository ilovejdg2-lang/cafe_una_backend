import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Compra } from './compra.entity';

@Entity('compra_items')
export class CompraItem {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'CompraId', type: 'int' })
  CompraId: number;

  @ManyToOne(() => Compra, (compra) => compra.Items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'CompraId' })
  Compra?: Compra;

  @Column({ name: 'ProductoId', type: 'varchar', length: 40, default: '' })
  ProductoId: string;

  @Column({ name: 'Nombre', type: 'varchar', length: 200 })
  Nombre: string;

  @Column({ name: 'Cantidad', type: 'int', default: 1 })
  Cantidad: number;

  @Column({
    name: 'PrecioUnitario',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  PrecioUnitario: string;

  @Column({
    name: 'Subtotal',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  Subtotal: string;
}
