import { resolveTestDatabaseUrl } from '../../src/database/test-database-url';
import { createPostgresTestDataSource } from './postgres-test-data-source';

describe('resolveTestDatabaseUrl', () => {
  it.each([
    ['an absent value', undefined],
    ['a blank value', '   '],
  ])('rejects %s', (_description, value) => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: value })).toThrow(
      'TEST_DATABASE_URL is required for integration tests',
    );
  });

  it.each([
    'postgresql://user:password@db.example.supabase.co:5432/postgres',
    'postgresql://user:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    'postgresql://user:password@AWS-1-US-EAST-1.POOLER.SUPABASE.COM.:5432/postgres',
  ])('rejects Supabase host %s', (databaseUrl) => {
    expect(() =>
      resolveTestDatabaseUrl({ TEST_DATABASE_URL: databaseUrl }),
    ).toThrow('Supabase hosts are not allowed for integration tests');
  });

  it('rejects a non-PostgreSQL URL', () => {
    expect(() =>
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL: 'mysql://user:password@localhost:3306/cafe_una_test',
      }),
    ).toThrow('TEST_DATABASE_URL must use the PostgreSQL protocol');
  });

  it('rejects an invalid URL with a configuration-specific message', () => {
    expect(() =>
      resolveTestDatabaseUrl({ TEST_DATABASE_URL: 'not-a-url' }),
    ).toThrow('TEST_DATABASE_URL must be a valid URL');
  });

  it('accepts an isolated local PostgreSQL URL', () => {
    const databaseUrl =
      'postgresql://inventory_test:secret@127.0.0.1:5432/cafe_una_test';

    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: databaseUrl })).toBe(
      databaseUrl,
    );
  });
});

describe('createPostgresTestDataSource', () => {
  it('builds a non-synchronizing PostgreSQL data source for the isolated URL', () => {
    const databaseUrl =
      'postgresql://inventory_test:secret@localhost:5432/cafe_una_test';

    const dataSource = createPostgresTestDataSource({
      TEST_DATABASE_URL: databaseUrl,
    });

    expect(dataSource.options).toMatchObject({
      type: 'postgres',
      url: databaseUrl,
      synchronize: false,
      ssl: false,
    });
    expect(dataSource.options.migrations).toHaveLength(1);
  });
});
