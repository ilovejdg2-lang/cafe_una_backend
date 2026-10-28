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
import { SolicitudSalidaInventario } from './solicitud-salida-inventario.entity';

@Entity('solicitudes_salida_inventario_items')
@Unique('UQ_solicitud_salida_inventario_item_producto', [
  'SolicitudId',
  'ProductoId',
])
@Check('CK_solicitud_salida_inventario_item_cantidad', '"Cantidad" > 0')
export class SolicitudSalidaInventarioItem {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'SolicitudId', type: 'bigint' })
  SolicitudId: string;

  @Column({ name: 'ProductoId', type: 'bigint' })
  ProductoId: string;

  @Column({ name: 'Cantidad', type: 'integer' })
  Cantidad: number;

  @ManyToOne(() => SolicitudSalidaInventario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'SolicitudId', referencedColumnName: 'Id' })
  Solicitud?: SolicitudSalidaInventario;

  @ManyToOne(() => Producto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ProductoId', referencedColumnName: 'Id' })
  Producto?: Producto;
}
