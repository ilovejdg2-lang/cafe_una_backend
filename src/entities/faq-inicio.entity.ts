import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('faq_inicio')
export class FaqInicio {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Pregunta', length: 500 })
  Pregunta: string;

  @Column({ name: 'PreguntaEn', length: 500, default: '' })
  PreguntaEn: string;

  @Column({ name: 'Respuesta', type: 'varchar', length: 4000 })
  Respuesta: string;

  @Column({ name: 'RespuestaEn', type: 'varchar', length: 4000, default: '' })
  RespuestaEn: string;

  @Column({ name: 'Orden', type: 'int', default: 0 })
  Orden: number;
}
