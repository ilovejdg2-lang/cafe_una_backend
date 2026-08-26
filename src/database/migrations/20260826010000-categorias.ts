import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';

export class Categorias20260826010000 implements MigrationInterface {
  name = 'Categorias20260826010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('categorias'))) {
      await queryRunner.createTable(
        new Table({
          name: 'categorias',
          columns: [
            {
              name: 'Id',
              type: 'bigint',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'Nombre', type: 'varchar', length: '80' },
            { name: 'Tipo', type: 'varchar', length: '20' },
          ],
        }),
      );
      await queryRunner.createUniqueConstraint(
        'categorias',
        new TableUnique({
          name: 'UQ_categorias_nombre_tipo',
          columnNames: ['Nombre', 'Tipo'],
        }),
      );
    }

    await this.addColumnIfMissing(queryRunner, 'productos', 'Categoria');
    await this.addColumnIfMissing(
      queryRunner,
      'galeria_institucional',
      'Categoria',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'productos', 'Categoria');
    await this.dropColumnIfExists(
      queryRunner,
      'galeria_institucional',
      'Categoria',
    );
    if (await queryRunner.hasTable('categorias')) {
      await queryRunner.dropTable('categorias');
    }
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(table, column);
    if (hasColumn) return;
    await queryRunner.query(
      `ALTER TABLE "${table}" ADD COLUMN "${column}" varchar(80) NOT NULL DEFAULT ''`,
    );
  }

  private async dropColumnIfExists(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    if (!(await queryRunner.hasColumn(table, column))) return;
    await queryRunner.query(
      `ALTER TABLE "${table}" DROP COLUMN "${column}"`,
    );
  }
}
