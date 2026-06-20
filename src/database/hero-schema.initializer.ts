import { DataSource } from 'typeorm';

/** Mismo SQL defensivo que HeroSchemaInitializer.cs del backend .NET. */
const HERO_SCHEMA_SQL = `
ALTER TABLE hero_principal
  ADD COLUMN IF NOT EXISTS "Eyebrow" character varying(200) NOT NULL DEFAULT '';

ALTER TABLE hero_principal
  ADD COLUMN IF NOT EXISTS "PrimaryButtonText" character varying(200) NOT NULL DEFAULT '';

ALTER TABLE hero_principal
  ADD COLUMN IF NOT EXISTS "PrimaryButtonUrl" character varying(500) NOT NULL DEFAULT '';

ALTER TABLE hero_principal
  ADD COLUMN IF NOT EXISTS "ButtonUrl" character varying(500) NOT NULL DEFAULT '';

ALTER TABLE textos_institucionales
  ADD COLUMN IF NOT EXISTS "LinkText" character varying(200);

ALTER TABLE tarjetas_inicio
  ADD COLUMN IF NOT EXISTS "TextoBoton" character varying(200) NOT NULL DEFAULT '';
`;

export async function ensureHeroSchema(dataSource: DataSource): Promise<void> {
  await dataSource.query(HERO_SCHEMA_SQL);
}
