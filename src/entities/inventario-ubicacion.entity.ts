import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('inventario_ubicaciones')
export class InventarioUbicacion {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'integer' })
  Id: number;

  @Column({ name: 'Codigo', type: 'varchar', length: 50, unique: true })
  Codigo: string;

  @Column({ name: 'Nombre', type: 'varchar', length: 100 })
  Nombre: string;

  @Column({ name: 'Activo', type: 'boolean', default: true })
  Activo: boolean;

  @Column({ name: 'ImagenUrl', type: 'varchar', length: 500, nullable: true })
  ImagenUrl: string | null;

  @Column({ name: 'Direccion', type: 'varchar', length: 300, nullable: true })
  Direccion: string | null;

  @Column({ name: 'MapsUrl', type: 'varchar', length: 500, nullable: true })
  MapsUrl: string | null;

  @Column({ name: 'Telefono', type: 'varchar', length: 40, nullable: true })
  Telefono: string | null;

  @Column({ name: 'Horario', type: 'varchar', length: 300, nullable: true })
  Horario: string | null;

  @Column({ name: 'Imagenes', type: 'text', nullable: true })
  Imagenes: string | null;
}
