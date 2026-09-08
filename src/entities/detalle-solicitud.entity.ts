import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Producto } from './producto.entity';
import { SolicitudCompra } from './solicitud-compra.entity';

@Entity('detalle_solicitud')
@Check('CK_detalle_solicitud_cantidad_positiva', '"CantidadSolicitada" > 0')
export class DetalleSolicitud {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'SolicitudId', type: 'bigint' })
  SolicitudId: string;

  @ManyToOne(() => SolicitudCompra, (solicitud) => solicitud.Detalles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'SolicitudId', referencedColumnName: 'Id' })
  Solicitud?: SolicitudCompra;

  @Column({ name: 'ProductoId', type: 'bigint' })
  ProductoId: string;

  @ManyToOne(() => Producto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ProductoId', referencedColumnName: 'Id' })
  Producto?: Producto;

  @Column({
    name: 'CantidadSolicitada',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  CantidadSolicitada: string;
}
