import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { resumenMysql } from '../config/mysql.config';

@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  async health() {
    const mysql = resumenMysql(this.config);

    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'mysql',
        connected: true,
        host: mysql.host,
        db: mysql.database,
      };
    } catch {
      return {
        status: 'degraded',
        database: 'mysql',
        connected: false,
        host: mysql.host,
        db: mysql.database,
      };
    }
  }
}
