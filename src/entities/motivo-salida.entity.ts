import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MovimientoInventario } from './movimiento-inventario.entity';

@Entity('motivos_salida')
export class MotivoSalida {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 80, unique: true })
  Nombre: string;

  @OneToMany(() => MovimientoInventario, (movimiento) => movimiento.MotivoSalida)
  Movimientos?: MovimientoInventario[];
}
