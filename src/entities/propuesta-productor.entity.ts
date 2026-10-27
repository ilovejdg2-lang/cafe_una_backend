import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Al aprobarse, los datos se copian a productores_activos (ProductorActivo),
 * que es lo que lee el sitio público.
 */
@Entity('propuestas_productores')
@Index('IX_propuestas_productores_usuario', ['UsuarioId'])
@Index('IX_propuestas_productores_estado_fecha', ['Estado', 'CreadoEn'])
export class PropuestaProductor {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'UsuarioId', type: 'int' })
  UsuarioId: number;

  @Column({ name: 'NombreEmprendimiento', type: 'varchar', length: 100 })
  NombreEmprendimiento: string;

  @Column({ name: 'ImagenReferencia', type: 'varchar', length: 200 })
  ImagenReferencia: string;

  @Column({ name: 'Provincia', type: 'varchar', length: 80, nullable: true })
  Provincia: string | null;

  @Column({ name: 'Canton', type: 'varchar', length: 80, nullable: true })
  Canton: string | null;

  @Column({ name: 'Distrito', type: 'varchar', length: 80, nullable: true })
  Distrito: string | null;

  @Column({ name: 'Direccion', type: 'varchar', length: 500 })
  Direccion: string;

  @Column({ name: 'EnlaceUbicacion', type: 'varchar', length: 500 })
  EnlaceUbicacion: string;

  /** Coordenadas confirmadas del lugar (no el centro de cámara del mapa). */
  @Column({ name: 'Latitud', type: 'double precision', nullable: true })
  Latitud: number | null;

  @Column({ name: 'Longitud', type: 'double precision', nullable: true })
  Longitud: number | null;

  @Column({ name: 'Descripcion', type: 'varchar', length: 2000 })
  Descripcion: string;

  @Column({ name: 'Facebook', type: 'varchar', length: 500, nullable: true })
  Facebook: string | null;

  @Column({ name: 'Instagram', type: 'varchar', length: 500, nullable: true })
  Instagram: string | null;

  @Column({ name: 'Whatsapp', type: 'varchar', length: 80, nullable: true })
  Whatsapp: string | null;

  @Column({ name: 'SitioWeb', type: 'varchar', length: 500, nullable: true })
  SitioWeb: string | null;

  @Column({ name: 'CorreoContacto', type: 'varchar', length: 200 })
  CorreoContacto: string;

  @Column({ name: 'TelefonoContacto', type: 'varchar', length: 20 })
  TelefonoContacto: string;

  @Column({ name: 'Estado', type: 'varchar', length: 20, default: 'Pendiente' })
  Estado: string;

  @Column({ name: 'TerminosAceptadosEn', type: 'timestamptz' })
  TerminosAceptadosEn: Date;

  @Column({ name: 'TerminosVersion', type: 'varchar', length: 40 })
  TerminosVersion: string;

  @Column({ name: 'ClaveIdempotencia', type: 'varchar', length: 80 })
  ClaveIdempotencia: string;

  @CreateDateColumn({ name: 'CreadoEn', type: 'timestamptz' })
  CreadoEn: Date;

  @UpdateDateColumn({ name: 'ActualizadoEn', type: 'timestamptz' })
  ActualizadoEn: Date;

  @Column({ name: 'RevisadoEn', type: 'timestamptz', nullable: true })
  RevisadoEn: Date | null;

  @Column({ name: 'RevisadoPorId', type: 'int', nullable: true })
  RevisadoPorId: number | null;

  @Column({ name: 'MotivoRechazo', type: 'varchar', length: 1000, nullable: true })
  MotivoRechazo: string | null;

  /** Sugerencias para el productor al rechazar; se incluyen en el correo. */
  @Column({ name: 'Sugerencias', type: 'varchar', length: 1000, nullable: true })
  Sugerencias: string | null;

  /** Solo administradores; nunca se envía al productor ni al sitio público. */
  @Column({ name: 'NotaInterna', type: 'varchar', length: 2000, nullable: true })
  NotaInterna: string | null;

  /** Cambios solicitados por el productor para un emprendimiento activo (en espera de aprobación). */
  @Column({ name: 'SolicitudEdicion', type: 'jsonb', nullable: true })
  SolicitudEdicion: Record<string, unknown> | null;

  /** Solicitud de baja o eliminación enviada por el productor (en espera de decisión de admin). */
  @Column({ name: 'SolicitudEliminacion', type: 'jsonb', nullable: true })
  SolicitudEliminacion: Record<string, unknown> | null;
}
