import { DataSource } from 'typeorm';
import { buildPostgresTestDataSourceOptions } from '../../src/database/postgres-test-data-source-options';
import { TestDatabaseEnvironment } from '../../src/database/test-database-url';

export function createPostgresTestDataSource(
  environment: TestDatabaseEnvironment = process.env,
): DataSource {
  return new DataSource(buildPostgresTestDataSourceOptions(environment));
}
