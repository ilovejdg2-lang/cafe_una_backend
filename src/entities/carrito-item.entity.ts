import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('carrito_items')
export class CarritoItem {
  @PrimaryColumn({ name: 'UsuarioId', type: 'int' })
  UsuarioId: number;

  @PrimaryColumn({ name: 'ProductoId', type: 'bigint' })
  ProductoId: string;

  @Column({ name: 'Cantidad', type: 'int' })
  Cantidad: number;

  @Column({ name: 'ActualizadoEn', type: 'timestamptz', default: () => 'NOW()' })
  ActualizadoEn: Date;
}
