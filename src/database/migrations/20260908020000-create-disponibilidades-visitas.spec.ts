import { QueryRunner } from 'typeorm';

import { CreateDisponibilidadesVisitas20260908020000 } from './20260908020000-create-disponibilidades-visitas';

describe('CreateDisponibilidadesVisitas20260908020000', () => {
  it('creates a visits-owned availability table with its invariants', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new CreateDisponibilidadesVisitas20260908020000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls
      .map(([statement]) => String(statement))
      .join('\n');

    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS disponibilidades_visitas',
    );
    expect(sql).toMatch(/"Habilitada" boolean NOT NULL DEFAULT true/);
    expect(sql).toMatch(/UNIQUE \("Fecha", "HoraInicio", "HoraFin"\)/);
    expect(sql).toMatch(/CHECK \("HoraFin" > "HoraInicio"\)/);
    expect(sql).toMatch(
      /ON disponibilidades_visitas \("Fecha", "Habilitada"\)/,
    );
  });

  it('links existing visit requests without invalidating historical rows', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new CreateDisponibilidadesVisitas20260908020000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls
      .map(([statement]) => String(statement))
      .join('\n');

    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS "DisponibilidadVisitaId" bigint NULL/,
    );
    expect(sql).toMatch(
      /FOREIGN KEY \("DisponibilidadVisitaId"\)[\s\S]*ON DELETE SET NULL/,
    );
    expect(sql).not.toMatch(/UPDATE solicitudes_visitas_grupales/);
  });

  it('removes only the availability relationship and table on rollback', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new CreateDisponibilidadesVisitas20260908020000();

    await migration.down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls
      .map(([statement]) => String(statement))
      .join('\n');

    expect(sql).toMatch(/DROP COLUMN IF EXISTS "DisponibilidadVisitaId"/);
    expect(sql).toContain('DROP TABLE IF EXISTS disponibilidades_visitas');
    expect(sql).not.toContain(
      'DROP TABLE IF EXISTS solicitudes_visitas_grupales',
    );
  });
});
