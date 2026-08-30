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
import { Usuario } from './usuario.entity';

@Entity('movimientos_inventario')
@Check('CK_movimientos_inventario_cantidad_positiva', '"Cantidad" > 0')
export class MovimientoInventario {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Tipo', type: 'varchar', length: 30 })
  Tipo: string;

  @Column({ name: 'ProductoId', type: 'bigint' })
  ProductoId: string;

  @ManyToOne(() => Producto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ProductoId', referencedColumnName: 'Id' })
  Producto?: Producto;

  @Column({ name: 'Cantidad', type: 'integer' })
  Cantidad: number;

  /** Nombre legible (columna legacy NOT NULL en Supabase). */
  @Column({ name: 'Responsable', type: 'varchar', length: 200, default: '' })
  ResponsableNombre: string;

  @Column({ name: 'ResponsableId', type: 'integer', nullable: true })
  ResponsableId: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ResponsableId', referencedColumnName: 'Id' })
  Responsable?: Usuario | null;

  /** Observaciones legacy (NOT NULL en Supabase). */
  @Column({ name: 'Observaciones', type: 'varchar', length: 500, default: '' })
  Observaciones: string;

  @Column({ name: 'Notas', type: 'varchar', length: 500, default: '' })
  Notas: string;

  @Column({ name: 'SolicitudId', type: 'bigint', nullable: true })
  SolicitudId: string | null;

  @ManyToOne(() => SolicitudCompra, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'SolicitudId', referencedColumnName: 'Id' })
  Solicitud?: SolicitudCompra | null;

  @Column({ name: 'UbicacionId', type: 'integer', nullable: true })
  UbicacionId: number | null;

  @Column({
    name: 'Fecha',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  Fecha: Date;
}
