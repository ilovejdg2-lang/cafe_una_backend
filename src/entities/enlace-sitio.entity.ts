import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('enlaces_sitio')
export class EnlaceSitio {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Etiqueta', length: 200 })
  Etiqueta: string;

  @Column({ name: 'Ruta', length: 500 })
  Ruta: string;

  @Column({ name: 'Seccion', length: 100 })
  Seccion: string;

  @Column({ name: 'Orden', type: 'int' })
  Orden: number;

  @Column({ name: 'AbrirEnNuevaPestana', default: false })
  AbrirEnNuevaPestana: boolean;
}
