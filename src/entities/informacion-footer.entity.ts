import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('informacion_footer')
export class InformacionFooter {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'LogoUrl', length: 1000, default: '' })
  LogoUrl: string;

  @Column({ name: 'LogoClaroUrl', length: 1000, default: '' })
  LogoClaroUrl: string;

  @Column({ name: 'FraseMarca', length: 500, default: '' })
  FraseMarca: string;

  @Column({ name: 'Telefono', length: 50, default: '' })
  Telefono: string;

  @Column({ name: 'Correo', length: 200, default: '' })
  Correo: string;

  @Column({ name: 'FacebookUrl', length: 500, default: '' })
  FacebookUrl: string;

  @Column({ name: 'InstagramUrl', length: 500, default: '' })
  InstagramUrl: string;

  @Column({ name: 'MapsUrl', length: 500, default: '' })
  MapsUrl: string;

  @Column({ name: 'TextoCopyright', length: 500, default: '' })
  TextoCopyright: string;
}
