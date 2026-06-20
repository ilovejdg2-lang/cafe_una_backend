import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getSupabaseSummary } from '../config/supabase.config';
import { ensureHeroSchema } from './hero-schema.initializer';

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const supabase = getSupabaseSummary(this.config);

    try {
      await this.dataSource.query('SELECT 1');
      await ensureHeroSchema(this.dataSource);
      this.logger.log(
        `Conexion a Supabase establecida correctamente (${supabase.host}/${supabase.database}).`,
      );
    } catch (error) {
      this.logger.error(
        'No se pudo conectar o inicializar el esquema en Supabase. La app continua.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
