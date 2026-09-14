import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Compra } from './compra.entity';

/**
 * Invoice identifier retained separately from a purchase so legacy external
 * invoice references can be protected by a database foreign key.
 */
@Entity('facturas')
export class Factura {
  @PrimaryColumn({ name: 'Id', type: 'varchar', length: 80 })
  Id: string;

  @Column({ name: 'CreadaEn', type: 'timestamptz', default: () => 'NOW()' })
  CreadaEn: Date;

  @OneToMany(() => Compra, (compra) => compra.Factura)
  Compras?: Compra[];
}
