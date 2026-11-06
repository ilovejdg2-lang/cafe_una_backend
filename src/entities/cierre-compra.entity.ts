import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Fecha en la que no se recogen pedidos. La unicidad (fecha, punto) vive en un
 * índice de expresión creado por la migración (COALESCE("UbicacionId", 0)).
 */
@Entity('cierres_compra')
export class CierreCompra {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'Fecha', type: 'date' })
  Fecha: string;

  @Column({ name: 'Nota', type: 'varchar', length: 300, default: '' })
  Nota: string;

  /** Punto de venta (inventario_ubicaciones). NULL = todos los puntos de venta. */
  @Column({ name: 'UbicacionId', type: 'integer', nullable: true })
  UbicacionId: number | null;

  @CreateDateColumn({ name: 'CreadoEn', type: 'timestamptz' })
  CreadoEn: Date;
}
