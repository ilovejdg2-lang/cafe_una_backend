import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('vendedor_punto_venta')
@Unique('UQ_vendedor_punto_venta', ['VendedorId', 'UbicacionId'])
export class VendedorPuntoVenta {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'VendedorId', type: 'integer' })
  VendedorId: number;

  @Column({ name: 'UbicacionId', type: 'integer' })
  UbicacionId: number;

  @Column({ name: 'Activo', type: 'boolean', default: true })
  Activo: boolean;

  @Column({ name: 'CreadoEn', type: 'timestamptz' })
  CreadoEn: Date;

  @Column({ name: 'ActualizadoEn', type: 'timestamptz' })
  ActualizadoEn: Date;

  @Column({ name: 'AsignadoPorId', type: 'integer', nullable: true })
  AsignadoPorId: number | null;
}
