import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Producto } from './producto.entity';
import { InventarioUbicacion } from './inventario-ubicacion.entity';

@Entity('inventario_stock_ubicaciones')
@Unique('UQ_inventario_stock_producto_ubicacion', [
  'ProductoId',
  'UbicacionId',
])
@Check('CK_inventario_stock_no_negativo', '"Stock" >= 0')
export class InventarioStockUbicacion {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'ProductoId', type: 'bigint' })
  ProductoId: string;

  @Column({ name: 'UbicacionId', type: 'integer' })
  UbicacionId: number;

  @Column({ name: 'Stock', type: 'integer' })
  Stock: number;

  @ManyToOne(() => Producto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ProductoId', referencedColumnName: 'Id' })
  Producto?: Producto;

  @ManyToOne(() => InventarioUbicacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'UbicacionId', referencedColumnName: 'Id' })
  Ubicacion?: InventarioUbicacion;
}
