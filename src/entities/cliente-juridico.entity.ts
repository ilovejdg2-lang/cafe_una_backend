import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Persona jurídica — ficha de cliente ligada a un usuario. */
@Entity('clientes_juridicos')
export class ClienteJuridico {
  @PrimaryGeneratedColumn({ name: 'Id' })
  Id: number;

  @Column({ name: 'UsuarioId', type: 'int', unique: true })
  UsuarioId: number;

  @Column({ name: 'RazonSocial', type: 'varchar', length: 200 })
  RazonSocial: string;

  @Column({ name: 'NombreComercial', type: 'varchar', length: 200 })
  NombreComercial: string;

  @Column({ name: 'RepresentanteLegal', type: 'varchar', length: 200 })
  RepresentanteLegal: string;

  @Column({ name: 'CedulaJuridica', type: 'varchar', length: 40 })
  CedulaJuridica: string;

  @Column({ name: 'DireccionFiscal', type: 'varchar', length: 300, nullable: true })
  DireccionFiscal: string | null;

  @Column({ name: 'Telefono', type: 'varchar', length: 40 })
  Telefono: string;

  @Column({ name: 'TelefonoOficina', type: 'varchar', length: 40, nullable: true })
  TelefonoOficina: string | null;

  @Column({ name: 'FechaRegistro', type: 'timestamptz', nullable: true })
  FechaRegistro: Date | null;

  @Column({ name: 'FechaVerificacion', type: 'timestamptz', nullable: true })
  FechaVerificacion: Date | null;
}
