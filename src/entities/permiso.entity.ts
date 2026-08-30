import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolPermiso } from './rol-permiso.entity';

@Entity('permisos')
export class Permiso {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'Codigo', length: 80, unique: true })
  Codigo: string;

  @Column({ name: 'Nombre', length: 200 })
  Nombre: string;

  @Column({ name: 'Activo', default: true })
  Activo: boolean;

  @OneToMany(() => RolPermiso, (rp) => rp.Permiso)
  RolPermisos: RolPermiso[];
}
