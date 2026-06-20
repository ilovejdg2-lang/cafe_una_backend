import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('tarjetas_inicio')
export class TarjetaInicio {
  @PrimaryColumn({ name: 'Clave', length: 50 })
  Clave: string;

  @Column({ name: 'Etiqueta', length: 100, default: '' })
  Etiqueta: string;

  @Column({ name: 'Titulo', length: 300, default: '' })
  Titulo: string;

  @Column({ name: 'Descripcion', length: 2000, default: '' })
  Descripcion: string;

  @Column({ name: 'Ruta', type: 'varchar', length: 300, nullable: true })
  Ruta: string | null;

  @Column({ name: 'TextoBoton', length: 200, default: '' })
  TextoBoton: string;

  @Column({ name: 'Orden', type: 'int', default: 0 })
  Orden: number;
}
