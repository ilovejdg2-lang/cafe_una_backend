import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { entities } from '../entities';

/**
 * Misma conexion Supabase que appsettings.Development.json del backend .NET:
 * Host=aws-1-us-east-1.pooler.supabase.com;Database=postgres;
 * Username=postgres.mtrbjaaujtvgpvsiwfdm;SSL Mode=Require;Trust Server Certificate=true
 */
export function buildSupabaseTypeOrmConfig(
  config: ConfigService,
): TypeOrmModuleOptions {
  const ssl = { rejectUnauthorized: false };

  const shared: TypeOrmModuleOptions = {
    type: 'postgres',
    entities,
    synchronize: false,
    ssl,
    extra: { ssl },
  };

  const host = config.get<string>('SUPABASE_HOST');
  if (host) {
    const username = config.get<string>('SUPABASE_USER');
    const password = config.get<string>('SUPABASE_PASSWORD');

    if (!username || !password) {
      throw new Error(
        'SUPABASE_USER y SUPABASE_PASSWORD son requeridos cuando se usa SUPABASE_HOST.',
      );
    }

    return {
      ...shared,
      host,
      port: Number(config.get<string>('SUPABASE_PORT') ?? 5432),
      username,
      password,
      database: config.get<string>('SUPABASE_DB') ?? 'postgres',
    };
  }

  const url = config.get<string>('DATABASE_URL');
  if (url) {
    return { ...shared, url };
  }

  throw new Error(
    'Configuracion Supabase requerida: defina SUPABASE_HOST (y credenciales) o DATABASE_URL.',
  );
}

export function getSupabaseSummary(config: ConfigService): {
  host: string;
  database: string;
  user: string;
} {
  const host =
    config.get<string>('SUPABASE_HOST') ??
    extractHostFromUrl(config.get<string>('DATABASE_URL'));

  return {
    host: host ?? 'unknown',
    database: config.get<string>('SUPABASE_DB') ?? 'postgres',
    user: config.get<string>('SUPABASE_USER') ?? 'unknown',
  };
}

function extractHostFromUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
