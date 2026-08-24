import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import { entities } from '../entities';
import {
  resolveTestDatabaseUrl,
  TestDatabaseEnvironment,
} from './test-database-url';

export function buildPostgresTestDataSourceOptions(
  environment: TestDatabaseEnvironment = process.env,
): DataSourceOptions {
  return {
    type: 'postgres',
    url: resolveTestDatabaseUrl(environment),
    entities,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
    ssl: false,
  };
}
