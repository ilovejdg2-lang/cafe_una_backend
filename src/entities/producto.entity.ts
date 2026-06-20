import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Nombre', length: 200 })
  Nombre: string;

  @Column({ name: 'Descripcion', length: 2000 })
  Descripcion: string;

  @Column({ name: 'Imagen', length: 1000 })
  Imagen: string;

  @Column({ name: 'PrecioNormal', type: 'decimal', precision: 12, scale: 2 })
  PrecioNormal: string;

  @Column({ name: 'PrecioConIVA', type: 'decimal', precision: 12, scale: 2 })
  PrecioConIVA: string;

  @Column({ name: 'Stock', type: 'int' })
  Stock: number;

  @Column({ name: 'Estado', length: 20, default: 'Habilitado' })
  Estado: string;

  @Column({ name: 'Peso', length: 50 })
  Peso: string;

  @Column({ name: 'EsDestacado', default: false })
  EsDestacado: boolean;
}
