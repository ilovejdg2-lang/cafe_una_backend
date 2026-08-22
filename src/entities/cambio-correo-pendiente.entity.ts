import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cambios_correo_pendientes')
export class CambioCorreoPendiente {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'UsuarioId', type: 'int' })
  UsuarioId: number;

  @Column({ name: 'NuevoCorreo', length: 200 })
  NuevoCorreo: string;

  @Column({ name: 'Token', length: 20 })
  Token: string;

  @Column({ name: 'ExpiraEnUtc', type: 'timestamptz' })
  ExpiraEnUtc: Date;

  @Column({ name: 'Usado', default: false })
  Usado: boolean;
}
