import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('equipo_sobre_nosotros')
export class EquipoMiembro {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Nombre', length: 200 })
  Nombre: string;

  @Column({ name: 'Cargo', length: 200 })
  Cargo: string;

  @Column({ name: 'CargoEn', length: 200, default: '' })
  CargoEn: string;

  @Column({ name: 'Correo', length: 200, default: '' })
  Correo: string;

  @Column({ name: 'Telefono', length: 50, default: '' })
  Telefono: string;

  @Column({ name: 'Foto', length: 1000, default: '' })
  Foto: string;

  @Column({ name: 'Orden', type: 'int', default: 0 })
  Orden: number;
}
