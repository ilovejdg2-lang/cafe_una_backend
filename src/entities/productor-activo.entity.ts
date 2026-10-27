import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Productores publicados en el sitio; se copian desde la propuesta aprobada. */
@Entity('productores_activos')
export class ProductorActivo {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'PropuestaId', type: 'bigint', unique: true })
  PropuestaId: string;

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

  @Column({ name: 'Activo', type: 'boolean', default: true })
  Activo: boolean;

  @CreateDateColumn({ name: 'PublicadoEn', type: 'timestamptz' })
  PublicadoEn: Date;

  @UpdateDateColumn({ name: 'ActualizadoEn', type: 'timestamptz' })
  ActualizadoEn: Date;
}
