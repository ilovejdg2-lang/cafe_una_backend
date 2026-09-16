import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Compra } from './compra.entity';

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'CompraId', type: 'integer' })
  CompraId: number;

  @ManyToOne(() => Compra, (compra) => compra.Pagos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'CompraId', referencedColumnName: 'Id' })
  Compra?: Compra;

  @Column({ name: 'Monto', type: 'numeric', precision: 14, scale: 2 })
  Monto: string;

  @Column({ name: 'Metodo', type: 'varchar', length: 50 })
  Metodo: string;

  @Column({ name: 'Estado', type: 'varchar', length: 40, default: 'Pendiente' })
  Estado: string;

  @CreateDateColumn({ name: 'Fecha', type: 'timestamptz' })
  Fecha: Date;
}
