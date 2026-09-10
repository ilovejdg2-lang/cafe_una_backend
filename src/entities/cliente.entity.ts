import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Persona natural — ficha de cliente ligada a un usuario. */
@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'UsuarioId', type: 'int', unique: true })
  UsuarioId: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 100 })
  Nombre: string;

  @Column({ name: 'Apellidos', type: 'varchar', length: 100 })
  Apellidos: string;

  @Column({ name: 'TipoDocumento', type: 'varchar', length: 20 })
  TipoDocumento: string;

  @Column({ name: 'Identificacion', type: 'varchar', length: 40 })
  Identificacion: string;

  @Column({ name: 'Telefono', type: 'varchar', length: 40 })
  Telefono: string;

  @Column({ name: 'FechaRegistro', type: 'timestamptz', nullable: true })
  FechaRegistro: Date | null;

  @Column({ name: 'FechaVerificacion', type: 'timestamptz', nullable: true })
  FechaVerificacion: Date | null;
}
