import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getSupabaseSummary } from './config/supabase.config';

@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  async health() {
    const supabase = getSupabaseSummary(this.config);

    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'supabase',
        connected: true,
        host: supabase.host,
        db: supabase.database,
      };
    } catch {
      return {
        status: 'degraded',
        database: 'supabase',
        connected: false,
        host: supabase.host,
        db: supabase.database,
      };
    }
  }
}
