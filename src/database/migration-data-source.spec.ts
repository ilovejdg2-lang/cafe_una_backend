import { join } from 'node:path';

describe('migration data source', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnvironment,
      ALLOW_REMOTE_MIGRATIONS: 'true',
      SUPABASE_HOST: 'localhost',
      SUPABASE_USER: 'postgres',
      SUPABASE_PASSWORD: 'postgres',
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  it('loads migrations without loading colocated test files', () => {
    const { default: dataSource } = require('./migration-data-source') as {
      default: import('typeorm').DataSource;
    };

    expect(dataSource.options.migrations).toEqual([
      expect.stringContaining(join('migrations', '!(*.spec).{ts,js}')),
    ]);
  });
});
