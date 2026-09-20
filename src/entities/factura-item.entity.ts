import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Factura } from './factura.entity';
import { Producto } from './producto.entity';

@Entity('factura_items')
export class FacturaItem {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'FacturaId', type: 'varchar', length: 80 })
  FacturaId: string;

  @ManyToOne(() => Factura, (factura) => factura.Items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'FacturaId', referencedColumnName: 'Id' })
  Factura?: Factura;

  @Column({ name: 'ProductoId', type: 'bigint', nullable: true })
  ProductoId: string | null;

  @ManyToOne(() => Producto, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'ProductoId', referencedColumnName: 'Id' })
  Producto?: Producto | null;

  @Column({ name: 'Descripcion', type: 'varchar', length: 250 })
  Descripcion: string;

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
