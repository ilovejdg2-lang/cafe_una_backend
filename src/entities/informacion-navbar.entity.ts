import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('informacion_navbar')
export class InformacionNavbar {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'LogoUrl', length: 1000, default: '' })
  LogoUrl: string;

  @Column({ name: 'LogoClaroUrl', length: 1000, default: '' })
  LogoClaroUrl: string;
}
