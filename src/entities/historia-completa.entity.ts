import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('historia_completa')
export class HistoriaCompleta {
  @PrimaryColumn({ name: 'Id', type: 'int' })
  Id: number;

  @Column({ name: 'Contenido', type: 'jsonb' })
  Contenido: Record<string, unknown>;

  @Column({ name: 'ActualizadoEn', type: 'timestamptz' })
  ActualizadoEn: Date;
}
