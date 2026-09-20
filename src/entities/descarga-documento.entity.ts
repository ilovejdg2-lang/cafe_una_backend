import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('descargas_documentos')
export class DescargaDocumento {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  Id: string;

  @Column({ name: 'DocumentoId', type: 'bigint' })
  DocumentoId: string;

  @Column({ name: 'UsuarioId', type: 'bigint', nullable: true })
  UsuarioId: string | null;

  @Column({ name: 'UsuarioNombre', type: 'varchar', length: 150, nullable: true })
  UsuarioNombre: string | null;

  @Column({ name: 'Ip', type: 'varchar', length: 64, nullable: true })
  Ip: string | null;

  @CreateDateColumn({ name: 'FechaDescarga' })
  FechaDescarga: Date;
}
