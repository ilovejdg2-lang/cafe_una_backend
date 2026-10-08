import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Listas cortas editables desde Ajustes (presentaciones, estados, métodos de pago). */
@Entity('catalogo_sistema')
export class CatalogoSistemaItem {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'Tipo', type: 'varchar', length: 40 })
  Tipo: string;

  @Column({ name: 'Nombre', type: 'varchar', length: 120 })
  Nombre: string;

  @Column({ name: 'Icono', type: 'varchar', length: 60, default: '' })
  Icono: string;

  @Column({ name: 'Orden', type: 'integer', default: 0 })
  Orden: number;

  @Column({ name: 'Activo', type: 'boolean', default: true })
  Activo: boolean;
}
