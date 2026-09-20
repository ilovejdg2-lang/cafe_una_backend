import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('documentos')
export class Documento {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Titulo', length: 200 })
  Titulo: string;

  @Column({ name: 'Descripcion', length: 2000, default: '' })
  Descripcion: string;

  @Column({ name: 'Categoria', length: 80, default: '' })
  Categoria: string;

  @Column({ name: 'Subcategoria', length: 80, default: '' })
  Subcategoria: string;

  /** Nombre del archivo físico en el almacenamiento local */
  @Column({ name: 'NombreArchivo', length: 255 })
  NombreArchivo: string;

  /** Nombre original que tenía el archivo al ser subido por el usuario */
  @Column({ name: 'NombreOriginal', length: 255 })
  NombreOriginal: string;

  @Column({ name: 'MimeType', length: 100, default: 'application/octet-stream' })
  MimeType: string;

  @Column({ name: 'TamanoBytes', type: 'bigint', default: 0 })
  TamanoBytes: number;

  /** Si es true, la descarga directa requiere permiso o solicitud aprobada */
  @Column({ name: 'EsPrivado', type: 'boolean', default: false })
  EsPrivado: boolean;

  @Column({ name: 'Autor', length: 150, default: '' })
  Autor: string;

  @Column({ name: 'Version', length: 20, default: '1.0' })
  Version: string;

  @Column({ name: 'PalabrasClave', length: 500, default: '' })
  PalabrasClave: string;

  @Column({ name: 'DescargasCount', type: 'int', default: 0 })
  DescargasCount: number;

  @Column({ name: 'Activo', type: 'boolean', default: true })
  Activo: boolean;

  @CreateDateColumn({ name: 'CreatedAt' })
  CreatedAt: Date;

  @UpdateDateColumn({ name: 'UpdatedAt' })
  UpdatedAt: Date;
}
