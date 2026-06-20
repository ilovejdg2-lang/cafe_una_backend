import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'Nombre', length: 200 })
  Nombre: string;

  @Column({ name: 'Correo', length: 200 })
  Correo: string;

  @Column({ name: 'PasswordHash', length: 500 })
  PasswordHash: string;

  @Column({ name: 'Estado', length: 20, default: 'activo' })
  Estado: string;

  @Column('text', { name: 'Roles', array: true })
  Roles: string[];

  @Column({ name: 'FotoPerfilUrl', type: 'varchar', length: 1000, nullable: true })
  FotoPerfilUrl: string | null;

  @Column({ name: 'FotoBannerUrl', type: 'varchar', length: 1000, nullable: true })
  FotoBannerUrl: string | null;

  @Column({ name: 'FotoPerfilPosicion', type: 'varchar', length: 30, nullable: true })
  FotoPerfilPosicion: string | null;

  @Column({ name: 'FotoBannerPosicion', type: 'varchar', length: 30, nullable: true })
  FotoBannerPosicion: string | null;
}
