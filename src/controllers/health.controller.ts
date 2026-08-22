import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { resumenPostgres } from '../config/postgres.config';

@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  async health() {
    const postgres = resumenPostgres(this.config);

    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'postgres',
        connected: true,
        host: postgres.host,
        db: postgres.database,
      };
    } catch {
      return {
        status: 'degraded',
        database: 'postgres',
        connected: false,
        host: postgres.host,
        db: postgres.database,
      };
    }
  }
}
