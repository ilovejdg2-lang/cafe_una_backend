import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('password_reset_entries')
export class PasswordResetEntry {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'Token', length: 20 })
  Token: string;

  @Column({ name: 'Correo', length: 200 })
  Correo: string;

  @Column({ name: 'ExpiraEnUtc', type: 'timestamptz' })
  ExpiraEnUtc: Date;

  @Column({ name: 'Usado', default: false })
  Usado: boolean;
}
