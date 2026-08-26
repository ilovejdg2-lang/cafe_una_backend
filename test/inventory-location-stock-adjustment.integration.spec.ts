import 'reflect-metadata';
import { DataSource, QueryRunner } from 'typeorm';
import { InventarioService } from '../src/services/inventario.service';
import { InventoryLocationStockFoundation20260824180000 } from '../src/database/migrations/20260824180000-inventory-location-stock-foundation';
import { createPostgresTestDataSource } from './support/postgres-test-data-source';
import { Auditoria } from '../src/entities/auditoria.entity';
import { InventarioStockUbicacion } from '../src/entities/inventario-stock-ubicacion.entity';
import { InventarioUbicacion } from '../src/entities/inventario-ubicacion.entity';
import { Producto } from '../src/entities/producto.entity';
import { entities } from '../src/entities';

const describeIntegration = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeIntegration('inventory location stock adjustment', () => {
  let bootstrapDataSource: DataSource;
  let serviceDataSource: DataSource;
  let bootstrapRunner: QueryRunner;
  let schemaName: string;
  const migration = new InventoryLocationStockFoundation20260824180000();

  beforeAll(async () => {
    bootstrapDataSource = createPostgresTestDataSource();
    await bootstrapDataSource.initialize();
    bootstrapRunner = bootstrapDataSource.createQueryRunner();
    await bootstrapRunner.connect();

    schemaName = `inventory_f08_${process.pid}_${Date.now()}`;
    await bootstrapRunner.query(`CREATE SCHEMA "${schemaName}"`);
    await bootstrapRunner.query(`SET search_path TO "${schemaName}"`);
    await bootstrapRunner.query(`
      CREATE TABLE productos (
        "Id" bigint PRIMARY KEY,
        "Nombre" varchar(200) NOT NULL,
        "Descripcion" varchar(2000) NOT NULL,
        "Imagen" varchar(1000) NOT NULL,
        "PrecioNormal" numeric(12, 2) NOT NULL,
        "PrecioConIVA" numeric(12, 2) NOT NULL,
        "Stock" integer NOT NULL,
        "Estado" varchar(20) NOT NULL DEFAULT 'Habilitado',
        "Peso" varchar(50) NOT NULL,
        "EsDestacado" boolean NOT NULL DEFAULT false
      )
    `);
    await bootstrapRunner.query(`
      CREATE TABLE auditoria (
        "Id" serial PRIMARY KEY,
        "Accion" varchar(50) NOT NULL,
        "Tabla" varchar(80) NOT NULL,
        "IdRegistro" varchar(50),
        "Detalle" varchar(500) NOT NULL DEFAULT '',
        "Fecha" timestamptz NOT NULL,
        "IdUsuario" integer
      )
    `);
    await bootstrapRunner.query(
      `INSERT INTO productos ("Id", "Nombre", "Descripcion", "Imagen", "PrecioNormal", "PrecioConIVA", "Stock", "Estado", "Peso", "EsDestacado")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        501,
        'Producto de integración',
        'Producto aislado',
        '',
        100,
        113,
        12,
        'Habilitado',
        '500g',
        true,
      ],
    );

    await migration.up(bootstrapRunner);
    await bootstrapRunner.query(`SET search_path TO public`);
    await bootstrapRunner.release();

    const isolatedUrl = new URL(process.env.TEST_DATABASE_URL as string);
    isolatedUrl.searchParams.set('options', `-c search_path="${schemaName}"`);
    serviceDataSource = new DataSource({
      type: 'postgres',
      url: isolatedUrl.toString(),
      entities,
      synchronize: false,
      ssl: false,
    });
    await serviceDataSource.initialize();
  });

  afterAll(async () => {
    if (serviceDataSource?.isInitialized) {
      await serviceDataSource.destroy();
    }
    if (bootstrapDataSource?.isInitialized) {
      const cleanupRunner = bootstrapDataSource.createQueryRunner();
      await cleanupRunner.connect();
      try {
        await cleanupRunner.query(
          `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
        );
      } finally {
        await cleanupRunner.release();
      }
      await bootstrapDataSource.destroy();
    }
  });

  it('updates POS stock and writes the audit record in the isolated database', async () => {
    const service = new InventarioService(
      serviceDataSource.getRepository(InventarioUbicacion),
      serviceDataSource.getRepository(InventarioStockUbicacion),
      serviceDataSource.getRepository(Producto),
      serviceDataSource,
      { verificarTrasMovimiento: async () => null } as never,
    );

    await expect(
      service.ajustarStockUbicacion(
        'POS_FUNA_UNA',
        '501',
        7,
        'Conteo inicial del punto de venta',
      ),
    ).resolves.toEqual({
      productId: '501',
      locationCode: 'POS_FUNA_UNA',
      previousStock: 0,
      stock: 7,
      reason: 'Conteo inicial del punto de venta',
    });

    const product = await serviceDataSource
      .getRepository(Producto)
      .findOneBy({ Id: '501' });
    const balance = await serviceDataSource
      .getRepository(InventarioStockUbicacion)
      .findOne({
        where: {
          ProductoId: '501',
          Ubicacion: { Codigo: 'POS_FUNA_UNA' },
        },
        relations: { Ubicacion: true },
      });
    const audit = await serviceDataSource
      .getRepository(Auditoria)
      .findOneBy({ Accion: 'AJUSTE_STOCK' });

    expect(product).toMatchObject({ Stock: 12, EsDestacado: true });
    expect(balance).toMatchObject({ Stock: 7 });
    expect(audit).toMatchObject({
      Tabla: 'inventario_stock_ubicaciones',
      IdUsuario: null,
    });
    expect(audit?.Detalle).toContain('nuevo 7');
  });
});
