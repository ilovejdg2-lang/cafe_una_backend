import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('proveedores')
export class Proveedor {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 200 })
  Nombre: string;

  @Column({ name: 'Correo', type: 'varchar', length: 150, default: '' })
  Correo: string;

  @Column({ name: 'Telefono', type: 'varchar', length: 40, default: '' })
  Telefono: string;

  @Column({ name: 'Activo', type: 'boolean', default: true })
  Activo: boolean;

  @Column({
    name: 'CreadoEn',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  CreadoEn: Date;
}
