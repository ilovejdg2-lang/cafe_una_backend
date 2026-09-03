import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventarioUbicacion } from './inventario-ubicacion.entity';
import { Producto } from './producto.entity';
import { Usuario } from './usuario.entity';

@Entity('transferencias')
@Check('CK_transferencias_cantidad_positiva', '"Cantidad" > 0')
export class Transferencia {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'ProductoId', type: 'bigint' })
  ProductoId: string;

  @Column({ name: 'UbicacionOrigenId', type: 'integer' })
  UbicacionOrigenId: number;

  @Column({ name: 'UbicacionDestinoId', type: 'integer' })
  UbicacionDestinoId: number;

  @Column({ name: 'Cantidad', type: 'integer' })
  Cantidad: number;

  @Column({ name: 'ResponsableId', type: 'integer', nullable: true })
  ResponsableId: number | null;

  @Column({ name: 'Notas', type: 'varchar', length: 500, default: '' })
  Notas: string;

  @Column({ name: 'Fecha', type: 'timestamptz', default: () => 'NOW()' })
  Fecha: Date;

  @ManyToOne(() => Producto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ProductoId', referencedColumnName: 'Id' })
  Producto?: Producto;

  @ManyToOne(() => InventarioUbicacion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'UbicacionOrigenId', referencedColumnName: 'Id' })
  Origen?: InventarioUbicacion;

  @ManyToOne(() => InventarioUbicacion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'UbicacionDestinoId', referencedColumnName: 'Id' })
  Destino?: InventarioUbicacion;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ResponsableId', referencedColumnName: 'Id' })
  Responsable?: Usuario;
}
