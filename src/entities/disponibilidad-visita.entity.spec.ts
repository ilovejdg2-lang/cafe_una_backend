import { getMetadataArgsStorage } from 'typeorm';

import { DisponibilidadVisita } from './disponibilidad-visita.entity';
import { VisitaGrupal } from './visita-grupal.entity';

describe('DisponibilidadVisita entity mapping', () => {
  it('maps the visits-owned slot and its database constraints', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      ({ target }) => target === DisponibilidadVisita,
    );
    const columns = metadata.columns.filter(
      ({ target }) => target === DisponibilidadVisita,
    );
    const indices = metadata.indices.filter(
      ({ target }) => target === DisponibilidadVisita,
    );
    const uniques = metadata.uniques.filter(
      ({ target }) => target === DisponibilidadVisita,
    );
    const checks = metadata.checks.filter(
      ({ target }) => target === DisponibilidadVisita,
    );

    expect(table?.name).toBe('disponibilidades_visitas');
    expect(columns.map(({ propertyName }) => propertyName)).toEqual(
      expect.arrayContaining([
        'Fecha',
        'HoraInicio',
        'HoraFin',
        'Habilitada',
        'Nota',
      ]),
    );
    expect(
      columns.find(({ propertyName }) => propertyName === 'Habilitada')?.options
        .default,
    ).toBe(true);
    expect(
      columns.find(({ propertyName }) => propertyName === 'Nota')?.options
        .nullable,
    ).toBe(true);
    expect(uniques).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columns: ['Fecha', 'HoraInicio', 'HoraFin'],
        }),
      ]),
    );
    expect(indices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columns: ['Fecha', 'Habilitada'] }),
      ]),
    );
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ expression: '"HoraFin" > "HoraInicio"' }),
      ]),
    );
  });

  it('maps visit requests to an optional availability with nullifying delete', () => {
    const metadata = getMetadataArgsStorage();
    const column = metadata.columns.find(
      ({ target, propertyName }) =>
        target === VisitaGrupal && propertyName === 'DisponibilidadVisitaId',
    );
    const relation = metadata.relations.find(
      ({ target, propertyName }) =>
        target === VisitaGrupal && propertyName === 'DisponibilidadVisita',
    );

    expect(column?.options).toEqual(
      expect.objectContaining({ type: 'bigint', nullable: true }),
    );
    expect(relation?.options).toEqual(
      expect.objectContaining({ nullable: true, onDelete: 'SET NULL' }),
    );
  });
});
