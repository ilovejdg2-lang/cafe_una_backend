import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { resumenPostgres } from '../config/postgres.config';

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const postgres = resumenPostgres(this.config);

    try {
      await this.dataSource.query('SELECT 1');
      await this.dataSource.query(`
        ALTER TABLE solicitudes_voluntariado
        ADD COLUMN IF NOT EXISTS "ObservacionesAdmin" varchar(2000) NULL;
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS categorias (
          "Id" bigserial PRIMARY KEY,
          "Nombre" varchar(80) NOT NULL,
          "Descripcion" varchar(500) NOT NULL DEFAULT '',
          "Tipo" varchar(20) NOT NULL,
          "Padre" varchar(80) NOT NULL DEFAULT ''
        );
      `);
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'categorias' AND column_name = 'nombre'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'categorias' AND column_name = 'Nombre'
          ) THEN
            ALTER TABLE categorias RENAME COLUMN nombre TO "Nombre";
          END IF;
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'categorias' AND column_name = 'tipo'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'categorias' AND column_name = 'Tipo'
          ) THEN
            ALTER TABLE categorias RENAME COLUMN tipo TO "Tipo";
          END IF;
        END
        $$;
      `);
      await this.dataSource.query(`
        ALTER TABLE categorias ADD COLUMN IF NOT EXISTS "Nombre" varchar(80) NOT NULL DEFAULT '';
      `);
      await this.dataSource.query(`
        ALTER TABLE categorias ADD COLUMN IF NOT EXISTS "Descripcion" varchar(500) NOT NULL DEFAULT '';
      `);
      await this.dataSource.query(`
        ALTER TABLE categorias ADD COLUMN IF NOT EXISTS "Tipo" varchar(20) NOT NULL DEFAULT 'producto';
      `);
      await this.dataSource.query(`
        ALTER TABLE categorias ADD COLUMN IF NOT EXISTS "Padre" varchar(80) NOT NULL DEFAULT '';
      `);
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'UQ_categorias_nombre_tipo'
          ) THEN
            ALTER TABLE categorias DROP CONSTRAINT "UQ_categorias_nombre_tipo";
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'UQ_categorias_nombre_tipo_padre'
          ) THEN
            ALTER TABLE categorias
              ADD CONSTRAINT "UQ_categorias_nombre_tipo_padre" UNIQUE ("Nombre", "Tipo", "Padre");
          END IF;
        END
        $$;
      `);
      await this.dataSource.query(`
        ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS "Categoria" varchar(80) NOT NULL DEFAULT '';
      `);
      await this.dataSource.query(`
        ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS "Subcategoria" varchar(80) NOT NULL DEFAULT '';
      `);
      await this.dataSource.query(`
        ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS "StockMinimo" integer NOT NULL DEFAULT 0;
      `);
      await this.dataSource.query(`
        ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS "AlertaStock" boolean NOT NULL DEFAULT false;
      `);
      await this.dataSource.query(`
        ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS "Disponible" boolean NOT NULL DEFAULT true;
      `);
      await this.dataSource.query(`
        ALTER TABLE galeria_institucional
        ADD COLUMN IF NOT EXISTS "Categoria" varchar(80) NOT NULL DEFAULT '';
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS inventario_ubicaciones (
          "Id" serial PRIMARY KEY,
          "Codigo" varchar(50) NOT NULL UNIQUE,
          "Nombre" varchar(100) NOT NULL,
          "Activo" boolean NOT NULL DEFAULT true
        );
      `);
      await this.dataSource.query(`
        ALTER TABLE inventario_ubicaciones
        ADD COLUMN IF NOT EXISTS "Activo" boolean NOT NULL DEFAULT true;
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS transferencias (
          "Id" bigserial PRIMARY KEY,
          "ProductoId" bigint NOT NULL,
          "UbicacionOrigenId" integer NOT NULL,
          "UbicacionDestinoId" integer NOT NULL,
          "Cantidad" integer NOT NULL,
          "ResponsableId" integer NULL,
          "Notas" varchar(500) NOT NULL DEFAULT '',
          "Fecha" timestamptz NOT NULL DEFAULT NOW(),
          CONSTRAINT "CK_transferencias_cantidad_positiva" CHECK ("Cantidad" > 0)
        );
      `);
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS "IDX_transferencias_ProductoId"
          ON transferencias ("ProductoId");
      `);
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS "IDX_transferencias_Fecha"
          ON transferencias ("Fecha");
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS inventario_stock_ubicaciones (
          "Id" bigserial PRIMARY KEY,
          "ProductoId" bigint NOT NULL,
          "UbicacionId" integer NOT NULL,
          "Stock" integer NOT NULL,
          CONSTRAINT "UQ_inventario_stock_producto_ubicacion" UNIQUE ("ProductoId", "UbicacionId"),
          CONSTRAINT "CK_inventario_stock_no_negativo" CHECK ("Stock" >= 0)
        );
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS activos_fijos (
          "Id" serial PRIMARY KEY,
          "Codigo" varchar(50) NOT NULL UNIQUE,
          "Nombre" varchar(200) NOT NULL,
          "Modelo" varchar(100) NOT NULL DEFAULT '',
          "NumeroSerie" varchar(100) NOT NULL DEFAULT '',
          "FechaCompra" date NULL,
          "ValorEnLibro" numeric(14,2) NOT NULL DEFAULT 0,
          "CodigoProyecto" varchar(50) NOT NULL DEFAULT '',
          "NombreCompleto" varchar(150) NOT NULL DEFAULT '',
          "DescripcionResponsable" varchar(200) NOT NULL DEFAULT '',
          "DescripcionProyecto" varchar(300) NOT NULL DEFAULT '',
          "Activo" boolean NOT NULL DEFAULT true
        );
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS compras (
          "Id" serial PRIMARY KEY,
          "Numero" varchar(40) NOT NULL UNIQUE,
          "UsuarioId" integer NULL,
          "ClienteNombre" varchar(150) NOT NULL DEFAULT '',
          "ClienteCorreo" varchar(150) NOT NULL DEFAULT '',
          "Fecha" timestamptz NOT NULL DEFAULT NOW(),
          "Subtotal" numeric(14,2) NOT NULL DEFAULT 0,
          "Impuestos" numeric(14,2) NOT NULL DEFAULT 0,
          "Total" numeric(14,2) NOT NULL DEFAULT 0,
          "MetodoPago" varchar(50) NOT NULL DEFAULT 'Tarjeta',
          "Estado" varchar(40) NOT NULL DEFAULT 'Pagado',
          "FacturaId" varchar(80) NULL
        );
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS compra_items (
          "Id" serial PRIMARY KEY,
          "CompraId" integer NOT NULL REFERENCES compras("Id") ON DELETE CASCADE,
          "ProductoId" varchar(40) NOT NULL DEFAULT '',
          "Nombre" varchar(200) NOT NULL,
          "Cantidad" integer NOT NULL DEFAULT 1,
          "PrecioUnitario" numeric(14,2) NOT NULL DEFAULT 0,
          "Subtotal" numeric(14,2) NOT NULL DEFAULT 0
        );
      `);
      await this.asegurarTablaAuditoria();
      await this.asegurarTriggersAuditoria();
      this.logger.log(
        `Conexión a PostgreSQL establecida (${postgres.host}/${postgres.database} como ${postgres.user}).`,
      );
    } catch (error) {
      this.logger.error(
        'No se pudo conectar a Supabase. Revise SUPABASE_HOST, SUPABASE_PORT y credenciales.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async asegurarTablaAuditoria(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        "Id" serial PRIMARY KEY,
        "Accion" varchar(50) NOT NULL,
        "Tabla" varchar(80) NOT NULL,
        "IdRegistro" varchar(50) NULL,
        "Detalle" varchar(500) NOT NULL DEFAULT '',
        "DatosAnteriores" jsonb NULL,
        "DatosNuevos" jsonb NULL,
        "Fecha" timestamptz NOT NULL DEFAULT NOW(),
        "IdUsuario" integer NULL
      );
    `);
    await this.dataSource.query(`
      ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS "DatosAnteriores" jsonb NULL;
    `);
    await this.dataSource.query(`
      ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS "DatosNuevos" jsonb NULL;
    `);
  }

  private async asegurarTriggersAuditoria(): Promise<void> {
    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION fn_cafe_auditoria() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        pk text := COALESCE(TG_ARGV[0], 'Id');
        v_id text;
        v_user text;
        v_uid int;
        v_old jsonb;
        v_new jsonb;
      BEGIN
        IF pk = 'Clave' THEN
          v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."Clave" ELSE NEW."Clave" END;
        ELSE
          v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."Id"::text ELSE NEW."Id"::text END;
        END IF;
        v_user := nullif(current_setting('app.auditoria_usuario_id', true), '');
        BEGIN
          v_uid := NULLIF(v_user, '')::int;
        EXCEPTION WHEN others THEN
          v_uid := NULL;
        END;
        v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
        v_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
        BEGIN
          INSERT INTO auditoria (
            "Accion", "Tabla", "IdRegistro", "Detalle",
            "DatosAnteriores", "DatosNuevos", "Fecha", "IdUsuario"
          )
          VALUES (
            TG_OP,
            TG_TABLE_NAME,
            v_id,
            TG_OP || ' en ' || TG_TABLE_NAME,
            v_old,
            v_new,
            NOW(),
            v_uid
          );
        EXCEPTION WHEN others THEN
          NULL;
        END;
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$;
    `);

    const tablasId = [
      'usuarios',
      'productos',
      'categorias',
      'hero_principal',
      'informacion_navbar',
      'informacion_footer',
      'galeria_institucional',
      'enlaces_sitio',
      'solicitudes_voluntariado',
      'inventario_ubicaciones',
      'activos_fijos',
      'compras',
      'compra_items',
    ];
    const tablasClave = ['textos_institucionales', 'tarjetas_inicio'];

    for (const tabla of tablasId) {
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF to_regclass('public.${tabla}') IS NOT NULL THEN
            EXECUTE 'DROP TRIGGER IF EXISTS tr_auditoria_${tabla} ON ${tabla}';
            EXECUTE 'CREATE TRIGGER tr_auditoria_${tabla}
              AFTER INSERT OR UPDATE OR DELETE ON ${tabla}
              FOR EACH ROW EXECUTE FUNCTION fn_cafe_auditoria()';
          END IF;
        END
        $$;
      `);
    }

    for (const tabla of tablasClave) {
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF to_regclass('public.${tabla}') IS NOT NULL THEN
            EXECUTE 'DROP TRIGGER IF EXISTS tr_auditoria_${tabla} ON ${tabla}';
            EXECUTE 'CREATE TRIGGER tr_auditoria_${tabla}
              AFTER INSERT OR UPDATE OR DELETE ON ${tabla}
              FOR EACH ROW EXECUTE FUNCTION fn_cafe_auditoria(''Clave'')';
          END IF;
        END
        $$;
      `);
    }
  }
}
