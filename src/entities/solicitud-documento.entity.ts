import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('solicitudes_documentos')
export class SolicitudDocumento {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'DocumentoId', type: 'bigint', nullable: true })
  DocumentoId: string | null;

  @Column({ name: 'DocumentoTitulo', type: 'varchar', length: 200, default: '' })
  DocumentoTitulo: string;

  @Column({ name: 'NombreSolicitante', length: 150 })
  NombreSolicitante: string;

  @Column({ name: 'CorreoSolicitante', length: 150 })
  CorreoSolicitante: string;

  @Column({ name: 'Institucion', length: 150, default: '' })
  Institucion: string;

  @Column({ name: 'Motivo', length: 1000, default: '' })
  Motivo: string;

  /** Archivo aportado/propuesto por el usuario */
  @Column({ name: 'NombreArchivo', type: 'varchar', length: 255, nullable: true })
  NombreArchivo: string | null;

  @Column({ name: 'NombreOriginal', type: 'varchar', length: 255, nullable: true })
  NombreOriginal: string | null;

  @Column({ name: 'MimeType', type: 'varchar', length: 100, nullable: true })
  MimeType: string | null;

  @Column({ name: 'TamanoBytes', type: 'bigint', default: 0 })
  TamanoBytes: number;

  @Column({ name: 'Categoria', type: 'varchar', length: 80, default: '' })
  Categoria: string;

  /** ID del documento generado en el catálogo cuando se aprueba */
  @Column({ name: 'PublicadoDocumentoId', type: 'bigint', nullable: true })
  PublicadoDocumentoId: string | null;

  /** Estado de la solicitud: 'Pendiente', 'Aprobada', 'Rechazada' */
  @Column({ name: 'Estado', length: 20, default: 'Pendiente' })
  Estado: string;

  /** Token seguro para descargar el archivo si fue aprobada */
  @Column({ name: 'TokenDescarga', type: 'varchar', length: 100, nullable: true })
  TokenDescarga: string | null;

  /** Fecha de expiración del token (ej. 48h) */
  @Column({ name: 'TokenExpira', type: 'timestamp', nullable: true })
  TokenExpira: Date | null;

  @Column({ name: 'RespuestaAdmin', type: 'varchar', length: 1000, nullable: true })
  RespuestaAdmin: string | null;

  @Column({ name: 'AtendidoPor', type: 'varchar', length: 150, nullable: true })
  AtendidoPor: string | null;

  @CreateDateColumn({ name: 'CreatedAt' })
  CreatedAt: Date;

  @UpdateDateColumn({ name: 'UpdatedAt' })
  UpdatedAt: Date;
}
