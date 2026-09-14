import { buildPostgresTestDataSourceOptions } from './postgres-test-data-source-options';
import { LegacyCommerceSchemaBootstrap20260824000000 } from './test-migrations/20260824000000-legacy-commerce-schema-bootstrap';

describe('buildPostgresTestDataSourceOptions', () => {
  it('excludes Jest specs from the migration CLI glob', () => {
    const options = buildPostgresTestDataSourceOptions({
      TEST_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/cafe_una_test',
    });

    expect(options.migrations).toEqual([
      LegacyCommerceSchemaBootstrap20260824000000,
      expect.stringMatching(/migrations[\\/]!\(\*\.spec\)\.\{ts,js\}$/),
    ]);
  });
});
