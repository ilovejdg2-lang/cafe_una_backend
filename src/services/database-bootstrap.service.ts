import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { resumenMysql } from '../config/mysql.config';

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const mysql = resumenMysql(this.config);

    try {
      await this.dataSource.query('SELECT 1');
      this.logger.log(
        `Conexion a MySQL establecida (${mysql.host}/${mysql.database} como ${mysql.user}).`,
      );
    } catch (error) {
      this.logger.error(
        'No se pudo conectar a MySQL. Revise MYSQL_HOST, MYSQL_PORT y credenciales.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
