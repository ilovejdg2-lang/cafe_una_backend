import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildPostgresTestDataSourceOptions } from './postgres-test-data-source-options';

const migrationDataSource = new DataSource(
  buildPostgresTestDataSourceOptions(),
);

export default migrationDataSource;
