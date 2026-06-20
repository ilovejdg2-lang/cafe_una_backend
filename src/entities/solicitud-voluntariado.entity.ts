import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('solicitudes_voluntariado')
export class SolicitudVoluntariado {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'UserId', length: 100 })
  UserId: string;

  @Column({ name: 'FechaSolicitud', length: 20 })
  FechaSolicitud: string;

  @Column({ name: 'Estado', length: 30, default: 'Pendiente' })
  Estado: string;

  @Column({ name: 'Nombre', type: 'varchar', length: 200, nullable: true })
  Nombre: string | null;

  @Column({ name: 'Email', type: 'varchar', length: 200, nullable: true })
  Email: string | null;

  @Column({ name: 'Telefono', type: 'varchar', length: 50, nullable: true })
  Telefono: string | null;

  @Column({ name: 'TipoVoluntariado', type: 'varchar', length: 100, nullable: true })
  TipoVoluntariado: string | null;

  @Column({ name: 'Identificacion', type: 'varchar', length: 100, nullable: true })
  Identificacion: string | null;

  @Column({ name: 'Institucion', type: 'varchar', length: 200, nullable: true })
  Institucion: string | null;

  @Column({ name: 'Pais', type: 'varchar', length: 100, nullable: true })
  Pais: string | null;

  @Column({ name: 'Modalidad', type: 'varchar', length: 100, nullable: true })
  Modalidad: string | null;

  @Column({ name: 'CantidadParticipantes', type: 'int', nullable: true })
  CantidadParticipantes: number | null;

  @Column({ name: 'Residencia', type: 'varchar', length: 200, nullable: true })
  Residencia: string | null;

  @Column({ name: 'Horario', type: 'varchar', length: 100, nullable: true })
  Horario: string | null;

  @Column({ name: 'Dias', type: 'varchar', length: 200, nullable: true })
  Dias: string | null;

  @Column({ name: 'Area', type: 'varchar', length: 200, nullable: true })
  Area: string | null;

  @Column({ name: 'Descripcion', type: 'varchar', length: 2000, nullable: true })
  Descripcion: string | null;

  @Column({ name: 'Motivacion', type: 'varchar', length: 2000, nullable: true })
  Motivacion: string | null;
}
