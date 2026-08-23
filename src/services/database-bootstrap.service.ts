import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { resumenPostgres } from '../config/postgres.config';

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const postgres = resumenPostgres(this.config);

    try {
      await this.dataSource.query('SELECT 1');
      await this.dataSource.query(`
        ALTER TABLE solicitudes_voluntariado
        ADD COLUMN IF NOT EXISTS "ObservacionesAdmin" varchar(2000) NULL;
      `);
      this.logger.log(
        `Conexión a PostgreSQL establecida (${postgres.host}/${postgres.database} como ${postgres.user}).`,
      );
    } catch (error) {
      this.logger.error(
        'No se pudo conectar a Supabase. Revise SUPABASE_HOST, SUPABASE_PORT y credenciales.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
