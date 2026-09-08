import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolPermiso } from './rol-permiso.entity';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'Nombre', length: 50, unique: true })
  Nombre: string;

  @Column({ name: 'Activo', default: true })
  Activo: boolean;

  @OneToMany(() => RolPermiso, (rp) => rp.Rol)
  RolPermisos: RolPermiso[];
}
