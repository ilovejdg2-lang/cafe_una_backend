import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('galeria_institucional')
export class GaleriaInstitucionalItem {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Title', length: 500 })
  Title: string;

  @Column({ name: 'Image', length: 1000 })
  Image: string;

  @Column({ name: 'Orden', type: 'int' })
  Orden: number;
}
