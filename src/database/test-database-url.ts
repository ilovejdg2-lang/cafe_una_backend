export interface TestDatabaseEnvironment {
  TEST_DATABASE_URL?: string;
}

const BLOCKED_SUPABASE_DOMAINS = ['supabase.co', 'supabase.com'];

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

function isSupabaseHost(hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);

  return BLOCKED_SUPABASE_DOMAINS.some(
    (domain) =>
      normalizedHostname === domain ||
      normalizedHostname.endsWith(`.${domain}`),
  );
}

export function resolveTestDatabaseUrl(
  environment: TestDatabaseEnvironment = process.env,
): string {
  const databaseUrl = environment.TEST_DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for integration tests');
  }

  const parsedUrl = new URL(databaseUrl);

  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error('TEST_DATABASE_URL must use the PostgreSQL protocol');
  }

  if (isSupabaseHost(parsedUrl.hostname)) {
    throw new Error('Supabase hosts are not allowed for integration tests');
  }

  return databaseUrl;
}
