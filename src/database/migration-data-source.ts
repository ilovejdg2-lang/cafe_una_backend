import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { entities } from '../entities';

ConfigModule.forRoot({ isGlobal: true });

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to run PostgreSQL migrations`);
  }
  return value;
}

if (process.env.ALLOW_REMOTE_MIGRATIONS !== 'true') {
  throw new Error(
    'Remote migrations are disabled. Set ALLOW_REMOTE_MIGRATIONS=true explicitly before running them.',
  );
}

const migrationDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: requiredEnvironment('SUPABASE_HOST'),
  port: Number(process.env.SUPABASE_PORT ?? 5432),
  username: requiredEnvironment('SUPABASE_USER'),
  password: requiredEnvironment('SUPABASE_PASSWORD'),
  database: process.env.SUPABASE_DB?.trim() || 'postgres',
  entities,
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  ssl: { rejectUnauthorized: false },
};

export default new DataSource(migrationDataSourceOptions);
