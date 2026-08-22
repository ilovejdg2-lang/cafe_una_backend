import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuditoriaSubscriber } from '../common/auditoria.subscriber';
import { entities } from '../entities';

export function construirConfigPostgres(
  config: ConfigService,
): TypeOrmModuleOptions {
  const host = config.get<string>('SUPABASE_HOST');
  const username = config.get<string>('SUPABASE_USER');
  const password = config.get<string>('SUPABASE_PASSWORD');

  if (!host || !username || !password) {
    throw new Error(
      'Faltan SUPABASE_HOST, SUPABASE_USER o SUPABASE_PASSWORD para conectar PostgreSQL.',
    );
  }

  return {
    type: 'postgres',
    host,
    port: Number(config.get<string>('SUPABASE_PORT') ?? 5432),
    username,
    password,
    database: config.get<string>('SUPABASE_DB') ?? 'postgres',
    entities,
    subscribers: [AuditoriaSubscriber],
    synchronize: false,
    ssl: { rejectUnauthorized: false },
    extra: {
      max: 10,
      connectionTimeoutMillis: 15_000,
    },
  };
}

export function resumenPostgres(config: ConfigService): {
  host: string;
  database: string;
  user: string;
} {
  return {
    host: config.get<string>('SUPABASE_HOST') ?? 'desconocido',
    database: config.get<string>('SUPABASE_DB') ?? 'postgres',
    user: config.get<string>('SUPABASE_USER') ?? 'desconocido',
  };
}
