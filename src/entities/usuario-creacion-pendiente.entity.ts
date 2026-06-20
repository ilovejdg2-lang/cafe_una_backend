import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usuarios_creacion_pendientes')
export class UsuarioCreacionPendiente {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'Token', length: 20 })
  Token: string;

  @Column({ name: 'Correo', length: 200 })
  Correo: string;

  @Column({ name: 'Nombre', length: 200 })
  Nombre: string;

  @Column({ name: 'PasswordHash', length: 500 })
  PasswordHash: string;

  @Column('text', { name: 'Roles', array: true })
  Roles: string[];

  @Column({ name: 'ExpiraEnUtc', type: 'timestamptz' })
  ExpiraEnUtc: Date;

  @Column({ name: 'Usado', default: false })
  Usado: boolean;
}
