import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Permiso } from './permiso.entity';
import { Rol } from './rol.entity';

@Entity('rol_permiso')
@Unique('UQ_rol_permiso_rol_permiso', ['RolId', 'PermisoId'])
export class RolPermiso {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'RolId' })
  RolId: number;

  @Column({ name: 'PermisoId' })
  PermisoId: number;

  @ManyToOne(() => Rol, (rol) => rol.RolPermisos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'RolId' })
  Rol: Rol;

  @ManyToOne(() => Permiso, (permiso) => permiso.RolPermisos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'PermisoId' })
  Permiso: Permiso;
}
