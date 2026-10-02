import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTurnosVisita20261002010000 implements MigrationInterface {
  name = 'CreateTurnosVisita20261002010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS turnos_visita (
        "Id" bigserial PRIMARY KEY,
        "HoraInicio" time NOT NULL,
        "HoraFin" time NOT NULL,
        "CapacidadMaxima" integer NOT NULL DEFAULT 30,
        "Habilitado" boolean NOT NULL DEFAULT true,
        "Nota" varchar(500) NULL,
        CONSTRAINT "UQ_turnos_visita_horas" UNIQUE ("HoraInicio", "HoraFin"),
        CONSTRAINT "CK_turnos_visita_horas" CHECK ("HoraFin" > "HoraInicio"),
        CONSTRAINT "CK_turnos_visita_capacidad" CHECK ("CapacidadMaxima" > 0)
      );
    `);

    await queryRunner.query(`
      ALTER TABLE disponibilidades_visitas
        ADD COLUMN IF NOT EXISTS "CapacidadMaxima" integer NOT NULL DEFAULT 30;
    `);

    // Insertar franjas horarias por defecto si turnos_visita está vacía
    await queryRunner.query(`
      INSERT INTO turnos_visita ("HoraInicio", "HoraFin", "CapacidadMaxima", "Habilitado", "Nota")
      VALUES
        ('09:00:00', '10:00:00', 30, true, 'Turno matutino 1'),
        ('10:30:00', '11:30:00', 30, true, 'Turno matutino 2'),
        ('13:00:00', '14:00:00', 30, true, 'Turno vespertino 1'),
        ('14:30:00', '15:30:00', 30, true, 'Turno vespertino 2')
      ON CONFLICT ("HoraInicio", "HoraFin") DO NOTHING;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE disponibilidades_visitas
        DROP COLUMN IF EXISTS "CapacidadMaxima";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS turnos_visita;`);
  }
}
