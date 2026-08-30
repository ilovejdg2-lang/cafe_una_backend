import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('hero_principal')
export class HeroPrincipal {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'Eyebrow', length: 200, default: '' })
  Eyebrow: string;

  @Column({ name: 'EyebrowEn', length: 200, default: '' })
  EyebrowEn: string;

  @Column({ name: 'Title', length: 500, default: '' })
  Title: string;

  @Column({ name: 'TitleEn', length: 500, default: '' })
  TitleEn: string;

  @Column({ name: 'Subtitle', length: 1000, default: '' })
  Subtitle: string;

  @Column({ name: 'SubtitleEn', length: 1000, default: '' })
  SubtitleEn: string;

  @Column({ name: 'PrimaryButtonText', length: 200, default: '' })
  PrimaryButtonText: string;

  @Column({ name: 'PrimaryButtonTextEn', length: 200, default: '' })
  PrimaryButtonTextEn: string;

  @Column({ name: 'PrimaryButtonUrl', length: 500, default: '' })
  PrimaryButtonUrl: string;

  @Column({ name: 'ButtonText', length: 200, default: '' })
  ButtonText: string;

  @Column({ name: 'ButtonTextEn', length: 200, default: '' })
  ButtonTextEn: string;

  @Column({ name: 'ButtonUrl', length: 500, default: '' })
  ButtonUrl: string;

  @Column({ name: 'BackgroundImage', length: 2000, default: '' })
  BackgroundImage: string;
}
