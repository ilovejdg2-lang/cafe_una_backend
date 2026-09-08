import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('categorias')
@Unique(['Nombre', 'Tipo', 'Padre'])
export class Categoria {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Nombre', length: 80 })
  Nombre: string;

  @Column({ name: 'Descripcion', length: 500, default: '' })
  Descripcion: string;

  @Column({ name: 'Tipo', length: 20 })
  Tipo: string;

  /** Vacío = categoría raíz. Si tiene valor, es subcategoría de ese padre. */
  @Column({ name: 'Padre', length: 80, default: '' })
  Padre: string;
}
