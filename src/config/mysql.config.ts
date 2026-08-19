import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuditoriaSubscriber } from '../common/auditoria.subscriber';
import { entities } from '../entities';

export function construirConfigMysql(
  config: ConfigService,
): TypeOrmModuleOptions {
  const host = config.get<string>('MYSQL_HOST');
  const username = config.get<string>('MYSQL_USER');
  const password = config.get<string>('MYSQL_PASSWORD');

  if (!host || !username || !password) {
    throw new Error(
      'Faltan MYSQL_HOST, MYSQL_USER o MYSQL_PASSWORD para conectar MySQL.',
    );
  }

  return {
    type: 'mysql',
    host,
    port: Number(config.get<string>('MYSQL_PORT') ?? 3307),
    username,
    password,
    database: config.get<string>('MYSQL_DB') ?? 'cafe_una',
    entities,
    subscribers: [AuditoriaSubscriber],
    synchronize: false,
    charset: 'utf8mb4',
    timezone: 'Z',
    extra: {
      charset: 'UTF8MB4_UNICODE_CI',
      connectionLimit: 10,
      connectTimeout: 10_000,
    },
  };
}

export function resumenMysql(config: ConfigService): {
  host: string;
  database: string;
  user: string;
} {
  return {
    host: config.get<string>('MYSQL_HOST') ?? 'desconocido',
    database: config.get<string>('MYSQL_DB') ?? 'cafe_una',
    user: config.get<string>('MYSQL_USER') ?? 'desconocido',
  };
}
