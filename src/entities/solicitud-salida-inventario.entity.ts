import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditoriaSolicitudSalidaInventario } from './auditoria-solicitud-salida-inventario.entity';
import { SolicitudSalidaInventarioItem } from './solicitud-salida-inventario-item.entity';

export const ESTADOS_SOLICITUD_SALIDA = {
  PENDIENTE: 'pendiente',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
  CANCELADA: 'cancelada',
} as const;

@Entity('solicitudes_salida_inventario')
@Check(
  'CK_solicitud_salida_inventario_tipo',
  "\"Tipo\" IN ('donacion', 'regalia')",
)
@Check(
  'CK_solicitud_salida_inventario_estado',
  "\"Estado\" IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')",
)
export class SolicitudSalidaInventario {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'Tipo', type: 'varchar', length: 16 })
  Tipo: 'donacion' | 'regalia';

  @Column({ name: 'Estado', type: 'varchar', length: 16, default: 'pendiente' })
  Estado: string;

  @Column({ name: 'FechaSalida', type: 'date' })
  FechaSalida: string;

  @Column({ name: 'MotivoSalidaId', type: 'integer' })
  MotivoSalidaId: number;

  @Column({ name: 'Destinatario', type: 'varchar', length: 200 })
  Destinatario: string;

  @Column({ name: 'ResponsableNombre', type: 'varchar', length: 200 })
  ResponsableNombre: string;

  @Column({ name: 'SolicitanteId', type: 'integer' })
  SolicitanteId: number;

  @Column({ name: 'RevisorId', type: 'integer', nullable: true })
  RevisorId: number | null;

  @Column({ name: 'FechaRevision', type: 'timestamptz', nullable: true })
  FechaRevision: Date | null;

  @Column({
    name: 'ComentarioRevision',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  ComentarioRevision: string | null;

  @CreateDateColumn({ name: 'CreadaEn', type: 'timestamptz' })
  CreadaEn: Date;

  @OneToMany(() => SolicitudSalidaInventarioItem, (item) => item.Solicitud)
  Items?: SolicitudSalidaInventarioItem[];

  @OneToMany(
    () => AuditoriaSolicitudSalidaInventario,
    (evento) => evento.Solicitud,
  )
  Historial?: AuditoriaSolicitudSalidaInventario[];
}
