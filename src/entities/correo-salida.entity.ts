import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('correos_salida')
export class CorreoSalida {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'ClaveUnica', type: 'varchar', length: 120, unique: true })
  ClaveUnica: string;

  @Column({ name: 'Destinatario', type: 'varchar', length: 200 })
  Destinatario: string;

  @Column({ name: 'Asunto', type: 'varchar', length: 200 })
  Asunto: string;

  @Column({ name: 'Html', type: 'text' })
  Html: string;

  @Column({ name: 'Texto', type: 'text' })
  Texto: string;

  @Column({ name: 'Estado', type: 'varchar', length: 20, default: 'pendiente' })
  Estado: string;

  @Column({ name: 'Intentos', type: 'int', default: 0 })
  Intentos: number;

  @Column({ name: 'ProximoIntento', type: 'timestamptz' })
  ProximoIntento: Date;

  @Column({ name: 'UltimoError', type: 'varchar', length: 500, nullable: true })
  UltimoError: string | null;

  @CreateDateColumn({ name: 'CreadoEn', type: 'timestamptz' })
  CreadoEn: Date;

  @Column({ name: 'EnviadoEn', type: 'timestamptz', nullable: true })
  EnviadoEn: Date | null;
}
