import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Singleton de parámetros globales (idioma predeterminado, etc.). */
@Entity('ajustes_sistema')
export class AjusteSistema {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  /** es | en */
  @Column({ name: 'IdiomaPredeterminado', length: 5, default: 'es' })
  IdiomaPredeterminado: string;
}
