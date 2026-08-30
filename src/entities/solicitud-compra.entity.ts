import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DetalleSolicitud } from './detalle-solicitud.entity';
import { Proveedor } from './proveedor.entity';
import { Usuario } from './usuario.entity';

export type HistorialEstadoSolicitud = {
  estado: string;
  fecha: string;
  usuarioId: number | null;
};

@Entity('solicitudes_compra')
@Check(
  'CK_solicitudes_compra_estado',
  `"Estado" IN ('pendiente','aprobada','recibida')`,
)
export class SolicitudCompra {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'ProveedorId', type: 'integer' })
  ProveedorId: number;

  @ManyToOne(() => Proveedor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ProveedorId', referencedColumnName: 'Id' })
  Proveedor?: Proveedor;

  @Column({
    name: 'Estado',
    type: 'varchar',
    length: 20,
    default: 'pendiente',
  })
  Estado: string;

  @Column({ name: 'FechaEstimadaEntrega', type: 'date', nullable: true })
  FechaEstimadaEntrega: string | null;

  @Column({
    name: 'UrlProformaPdf',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  UrlProformaPdf: string | null;

  @Column({ name: 'Notas', type: 'varchar', length: 1000, default: '' })
  Notas: string;

  @Column({ name: 'CreadoPor', type: 'integer', nullable: true })
  CreadoPor: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'CreadoPor', referencedColumnName: 'Id' })
  Creador?: Usuario | null;

  @Column({
    name: 'HistorialEstados',
    type: 'jsonb',
    default: () => "'[]'",
  })
  HistorialEstados: HistorialEstadoSolicitud[];

  @Column({
    name: 'CreadoEn',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  CreadoEn: Date;

  @Column({
    name: 'ActualizadoEn',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  ActualizadoEn: Date;

  @OneToMany(() => DetalleSolicitud, (detalle) => detalle.Solicitud, {
    cascade: true,
  })
  Detalles?: DetalleSolicitud[];
}
