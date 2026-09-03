import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('inventario_ubicaciones')
export class InventarioUbicacion {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'Codigo', type: 'varchar', length: 50, unique: true })
  Codigo: string;

  @Column({ name: 'Nombre', type: 'varchar', length: 100 })
  Nombre: string;

  @Column({ name: 'Activo', type: 'boolean', default: true })
  Activo: boolean;
}
