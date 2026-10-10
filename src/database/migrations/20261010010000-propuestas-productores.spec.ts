import { PropuestasProductores20261010010000 } from './20261010010000-propuestas-productores';

describe('migración de propuestas de productores', () => {
  it('crea las tablas nuevas sin borrar tablas existentes', async () => {
    const consultas: string[] = [];
    const runner = {
      query: async (sql: string) => {
        consultas.push(sql);
      },
    };
    const migracion = new PropuestasProductores20261010010000();
    await migracion.up(runner as never);
    const sql = consultas.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS propuestas_productores');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS notificaciones');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS correos_salida');
    expect(sql).not.toContain('DROP TABLE');
  });
});
