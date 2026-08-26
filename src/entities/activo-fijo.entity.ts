import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('activos_fijos')
export class ActivoFijo {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'Codigo', type: 'varchar', length: 50, unique: true })
  Codigo: string;

  @Column({ name: 'Nombre', type: 'varchar', length: 200 })
  Nombre: string;

  @Column({ name: 'Modelo', type: 'varchar', length: 100, default: '' })
  Modelo: string;

  @Column({ name: 'NumeroSerie', type: 'varchar', length: 100, default: '' })
  NumeroSerie: string;

  @Column({ name: 'FechaCompra', type: 'date', nullable: true })
  FechaCompra: string | null;

  @Column({
    name: 'ValorEnLibro',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  ValorEnLibro: string;

  @Column({ name: 'CodigoProyecto', type: 'varchar', length: 50, default: '' })
  CodigoProyecto: string;

  @Column({ name: 'NombreCompleto', type: 'varchar', length: 150, default: '' })
  NombreCompleto: string;

  @Column({
    name: 'DescripcionResponsable',
    type: 'varchar',
    length: 200,
    default: '',
  })
  DescripcionResponsable: string;

  @Column({
    name: 'DescripcionProyecto',
    type: 'varchar',
    length: 300,
    default: '',
  })
  DescripcionProyecto: string;

  @Column({ name: 'Activo', type: 'boolean', default: true })
  Activo: boolean;
}
