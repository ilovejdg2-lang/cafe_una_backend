import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Compra } from './compra.entity';
import { Producto } from './producto.entity';

@Entity('compra_items')
export class CompraItem {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'CompraId', type: 'int' })
  CompraId: number;

  @ManyToOne(() => Compra, (compra) => compra.Items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'CompraId', referencedColumnName: 'Id' })
  Compra?: Compra;

  @Column({ name: 'ProductoId', type: 'bigint', nullable: true })
  ProductoId: string | null;

  @ManyToOne(() => Producto, (producto) => producto.CompraItems, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'ProductoId', referencedColumnName: 'Id' })
  Producto?: Producto | null;

  @Column({ name: 'Nombre', type: 'varchar', length: 200 })
  Nombre: string;

  @Column({ name: 'Cantidad', type: 'int', default: 1 })
  Cantidad: number;

  @Column({ name: 'PrecioUnitario', type: 'numeric', precision: 14, scale: 2, default: 0 })
  PrecioUnitario: string;

  @Column({ name: 'Subtotal', type: 'numeric', precision: 14, scale: 2, default: 0 })
  Subtotal: string;
}
