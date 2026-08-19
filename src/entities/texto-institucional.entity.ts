import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('textos_institucionales')
export class TextoInstitucional {
  @PrimaryColumn({ name: 'Clave', length: 50 })
  Clave: string;

  @Column({ name: 'Eyebrow', type: 'varchar', length: 200, nullable: true })
  Eyebrow: string | null;

  @Column({ name: 'Title', length: 500, default: '' })
  Title: string;

  @Column({ name: 'Description', length: 4000, default: '' })
  Description: string;

  @Column({ name: 'Image', type: 'varchar', length: 1000, nullable: true })
  Image: string | null;

  @Column({ name: 'LinkUrl', type: 'varchar', length: 1000, nullable: true })
  LinkUrl: string | null;

  @Column({ name: 'LinkText', type: 'varchar', length: 200, nullable: true })
  LinkText: string | null;
}
