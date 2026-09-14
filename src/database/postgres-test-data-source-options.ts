import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import { entities } from '../entities';
import {
  resolveTestDatabaseUrl,
  TestDatabaseEnvironment,
} from './test-database-url';
import { LegacyCommerceSchemaBootstrap20260824000000 } from './test-migrations/20260824000000-legacy-commerce-schema-bootstrap';

export function buildPostgresTestDataSourceOptions(
  environment: TestDatabaseEnvironment = process.env,
): DataSourceOptions {
  return {
    type: 'postgres',
    url: resolveTestDatabaseUrl(environment),
    entities,
    migrations: [
      LegacyCommerceSchemaBootstrap20260824000000,
      join(__dirname, 'migrations', '!(*.spec).{ts,js}'),
    ],
    synchronize: false,
    ssl: false,
  };
}
