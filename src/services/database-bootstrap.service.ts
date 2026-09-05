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
        ALTER TABLE solicitudes_voluntariado
        ADD COLUMN IF NOT EXISTS "DocumentoAdjunto" varchar(300) NULL;
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS fechas_voluntariado (
          "Id" serial PRIMARY KEY,
          "Fecha" date NOT NULL UNIQUE,
          "Habilitada" boolean NOT NULL DEFAULT true,
          "CupoMaximo" int NULL,
          "Observaciones" varchar(500) NOT NULL DEFAULT '',
          "CreatedAt" timestamp NOT NULL DEFAULT NOW(),
          "UpdatedAt" timestamp NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "IDX_fechas_voluntariado_fecha"
          ON fechas_voluntariado ("Fecha");
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
          "Estado" varchar(40) NOT NULL DEFAULT 'Pendiente',
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
      await this.asegurarTablasSolicitudesCompra();
      await this.asegurarTablasRolesPermisos();
      await this.asegurarTablaDisponibilidadGrupos();
      await this.asegurarTablaAjustesEIdiomas();
      await this.asegurarTraduccionesInglesVacias();
      await this.asegurarTablaAuditoria();
      await this.asegurarTriggersAuditoria();
      await this.asegurarTablasDonaciones();
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

  private async asegurarTablasSolicitudesCompra(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS proveedores (
        "Id" serial PRIMARY KEY,
        "Nombre" varchar(200) NOT NULL,
        "Correo" varchar(150) NOT NULL DEFAULT '',
        "Telefono" varchar(40) NOT NULL DEFAULT '',
        "Activo" boolean NOT NULL DEFAULT true,
        "CreadoEn" timestamptz NOT NULL DEFAULT NOW()
      );
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_compra (
        "Id" bigserial PRIMARY KEY,
        "ProveedorId" integer NOT NULL,
        "Estado" varchar(20) NOT NULL DEFAULT 'pendiente',
        "FechaEstimadaEntrega" date NULL,
        "UrlProformaPdf" varchar(1000) NULL,
        "Notas" varchar(1000) NOT NULL DEFAULT '',
        "CreadoPor" integer NULL,
        "HistorialEstados" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "CreadoEn" timestamptz NOT NULL DEFAULT NOW(),
        "ActualizadoEn" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "CK_solicitudes_compra_estado"
          CHECK ("Estado" IN ('pendiente', 'aprobada', 'recibida'))
      );
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_solicitudes_compra_Estado"
        ON solicitudes_compra ("Estado");
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_solicitudes_compra_ProveedorId"
        ON solicitudes_compra ("ProveedorId");
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS detalle_solicitud (
        "Id" bigserial PRIMARY KEY,
        "SolicitudId" bigint NOT NULL
          REFERENCES solicitudes_compra("Id") ON DELETE CASCADE,
        "ProductoId" bigint NOT NULL,
        "CantidadSolicitada" numeric(12,2) NOT NULL,
        CONSTRAINT "CK_detalle_solicitud_cantidad_positiva"
          CHECK ("CantidadSolicitada" > 0)
      );
    `);
    await this.dataSource.query(`
      ALTER TABLE detalle_solicitud
        ADD COLUMN IF NOT EXISTS "SolicitudId" bigint NULL;
    `);
    await this.dataSource.query(`
      ALTER TABLE detalle_solicitud
        ADD COLUMN IF NOT EXISTS "ProductoId" bigint NULL;
    `);
    await this.dataSource.query(`
      ALTER TABLE detalle_solicitud
        ADD COLUMN IF NOT EXISTS "CantidadSolicitada" numeric(12,2) NULL;
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_detalle_solicitud_SolicitudId"
        ON detalle_solicitud ("SolicitudId");
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_detalle_solicitud_ProductoId"
        ON detalle_solicitud ("ProductoId");
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS movimientos_inventario (
        "Id" bigserial PRIMARY KEY,
        "Tipo" varchar(30) NOT NULL,
        "ProductoId" bigint NOT NULL,
        "Cantidad" integer NOT NULL,
        "Responsable" varchar(200) NOT NULL DEFAULT '',
        "ResponsableId" integer NULL,
        "Observaciones" varchar(500) NOT NULL DEFAULT '',
        "Notas" varchar(500) NOT NULL DEFAULT '',
        "SolicitudId" bigint NULL,
        "Fecha" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "CK_movimientos_inventario_cantidad_positiva"
          CHECK ("Cantidad" > 0)
      );
    `);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'movimientos_inventario'
            AND column_name = 'TipoMovimiento'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'movimientos_inventario'
            AND column_name = 'Tipo'
        ) THEN
          ALTER TABLE movimientos_inventario
            RENAME COLUMN "TipoMovimiento" TO "Tipo";
        ELSIF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'movimientos_inventario'
            AND column_name = 'TipoMovimiento'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'movimientos_inventario'
            AND column_name = 'Tipo'
        ) THEN
          UPDATE movimientos_inventario
          SET "Tipo" = COALESCE(NULLIF("Tipo", ''), NULLIF("TipoMovimiento", ''), 'entrada')
          WHERE "Tipo" IS NULL OR "Tipo" = '';
          ALTER TABLE movimientos_inventario DROP COLUMN "TipoMovimiento";
        END IF;
      END
      $$;
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "Tipo" varchar(30);
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "ProductoId" bigint;
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "Cantidad" integer;
    `);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'movimientos_inventario'
            AND column_name = 'Cantidad'
            AND data_type IN ('numeric', 'double precision', 'real')
        ) THEN
          ALTER TABLE movimientos_inventario
            ALTER COLUMN "Cantidad" TYPE integer
            USING ROUND("Cantidad")::integer;
        END IF;
      END
      $$;
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "ResponsableId" integer NULL;
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "Responsable" varchar(200) NOT NULL DEFAULT '';
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "Observaciones" varchar(500) NOT NULL DEFAULT '';
    `);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'movimientos_inventario'
            AND column_name = 'Responsable'
        ) THEN
          ALTER TABLE movimientos_inventario
            ALTER COLUMN "Responsable" SET DEFAULT '';
          UPDATE movimientos_inventario
          SET "Responsable" = COALESCE("Responsable", '')
          WHERE "Responsable" IS NULL;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'movimientos_inventario'
            AND column_name = 'Observaciones'
        ) THEN
          ALTER TABLE movimientos_inventario
            ALTER COLUMN "Observaciones" SET DEFAULT '';
          UPDATE movimientos_inventario
          SET "Observaciones" = COALESCE("Observaciones", '')
          WHERE "Observaciones" IS NULL;
        END IF;
      END
      $$;
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "Notas" varchar(500) NOT NULL DEFAULT '';
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "SolicitudId" bigint NULL;
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "Fecha" timestamptz NOT NULL DEFAULT NOW();
    `);
    await this.dataSource.query(`
      UPDATE movimientos_inventario
      SET "Tipo" = COALESCE(NULLIF("Tipo", ''), 'entrada')
      WHERE "Tipo" IS NULL OR "Tipo" = '';
    `);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'movimientos_inventario'
            AND column_name = 'Tipo'
            AND is_nullable = 'YES'
        ) THEN
          ALTER TABLE movimientos_inventario ALTER COLUMN "Tipo" SET NOT NULL;
        END IF;
      END
      $$;
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_movimientos_inventario_ProductoId"
        ON movimientos_inventario ("ProductoId");
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_movimientos_inventario_SolicitudId"
        ON movimientos_inventario ("SolicitudId");
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_movimientos_inventario_Fecha"
        ON movimientos_inventario ("Fecha");
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "UbicacionId" integer NULL;
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_movimientos_inventario_UbicacionId"
        ON movimientos_inventario ("UbicacionId");
    `);
    await this.asegurarHistorialMovimientosP06();
  }

  /** INV-P06: origen/destino, índice por tipo y bitácora append-only. */
  private async asegurarHistorialMovimientosP06(): Promise<void> {
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "UbicacionOrigenId" integer NULL;
    `);
    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS "UbicacionDestinoId" integer NULL;
    `);

    await this.dataSource.query(`
      ALTER TABLE movimientos_inventario DISABLE TRIGGER USER;
    `);
    try {
      await this.dataSource.query(`
        UPDATE movimientos_inventario
        SET "Tipo" = 'venta_presencial'
        WHERE lower(replace(btrim("Tipo"), ' ', '_')) IN ('venta_presencial', 'venta');
      `);
      await this.dataSource.query(`
        UPDATE movimientos_inventario
        SET "Tipo" = 'venta_web'
        WHERE lower(replace(btrim("Tipo"), ' ', '_')) = 'venta_web';
      `);
      await this.dataSource.query(`
        UPDATE movimientos_inventario
        SET "Tipo" = 'transferencia'
        WHERE lower(btrim("Tipo")) = 'transferencia';
      `);
      await this.dataSource.query(`
        UPDATE movimientos_inventario
        SET "Tipo" = 'entrada'
        WHERE "Tipo" IS NULL
          OR btrim("Tipo") = ''
          OR lower(btrim("Tipo")) = 'entrada'
          OR "Tipo" NOT IN (
            'entrada', 'transferencia', 'venta_presencial', 'venta_web'
          );
      `);
      await this.dataSource.query(`
        UPDATE movimientos_inventario
        SET "UbicacionOrigenId" = COALESCE("UbicacionOrigenId", "UbicacionId")
        WHERE "Tipo" IN ('venta_presencial', 'venta_web', 'transferencia')
          AND "UbicacionOrigenId" IS NULL
          AND "UbicacionId" IS NOT NULL;
      `);
      await this.dataSource.query(`
        UPDATE movimientos_inventario
        SET "UbicacionDestinoId" = COALESCE("UbicacionDestinoId", "UbicacionId")
        WHERE "Tipo" IN ('entrada', 'transferencia')
          AND "UbicacionDestinoId" IS NULL
          AND "UbicacionId" IS NOT NULL;
      `);
    } finally {
      await this.dataSource.query(`
        ALTER TABLE movimientos_inventario ENABLE TRIGGER USER;
      `);
    }

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_movimientos_inventario_Tipo"
        ON movimientos_inventario ("Tipo");
    `);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CK_movimientos_inventario_tipo'
        ) THEN
          ALTER TABLE movimientos_inventario
            ADD CONSTRAINT "CK_movimientos_inventario_tipo"
            CHECK ("Tipo" IN ('entrada', 'transferencia', 'venta_presencial', 'venta_web'));
        END IF;
      END
      $$;
    `);
    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION fn_movimientos_inventario_append_only()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'El historial de movimientos es de solo inserción.';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await this.dataSource.query(`
      DROP TRIGGER IF EXISTS trg_movimientos_inventario_no_update
        ON movimientos_inventario;
    `);
    await this.dataSource.query(`
      CREATE TRIGGER trg_movimientos_inventario_no_update
        BEFORE UPDATE ON movimientos_inventario
        FOR EACH ROW
        EXECUTE FUNCTION fn_movimientos_inventario_append_only();
    `);
    await this.dataSource.query(`
      DROP TRIGGER IF EXISTS trg_movimientos_inventario_no_delete
        ON movimientos_inventario;
    `);
    await this.dataSource.query(`
      CREATE TRIGGER trg_movimientos_inventario_no_delete
        BEFORE DELETE ON movimientos_inventario
        FOR EACH ROW
        EXECUTE FUNCTION fn_movimientos_inventario_append_only();
    `);
  }

  private async asegurarTablasRolesPermisos(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS roles (
        "Id" serial PRIMARY KEY,
        "Nombre" varchar(50) NOT NULL UNIQUE,
        "Activo" boolean NOT NULL DEFAULT true
      );
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS permisos (
        "Id" serial PRIMARY KEY,
        "Codigo" varchar(80) NOT NULL UNIQUE,
        "Nombre" varchar(200) NOT NULL,
        "Activo" boolean NOT NULL DEFAULT true
      );
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS rol_permiso (
        "Id" serial PRIMARY KEY,
        "RolId" integer NOT NULL REFERENCES roles("Id") ON DELETE CASCADE,
        "PermisoId" integer NOT NULL REFERENCES permisos("Id") ON DELETE CASCADE,
        CONSTRAINT "UQ_rol_permiso_rol_permiso" UNIQUE ("RolId", "PermisoId")
      );
    `);
  }

  private async asegurarTablaDisponibilidadGrupos(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS disponibilidad_grupos (
        "Id" serial PRIMARY KEY,
        "Tipo" varchar(30) NOT NULL,
        "Fecha" date NOT NULL,
        "HoraInicio" varchar(5) NOT NULL DEFAULT '',
        "HoraFin" varchar(5) NOT NULL DEFAULT '',
        "Disponible" boolean NOT NULL DEFAULT true,
        "CupoMaximo" integer NULL,
        "Nota" varchar(300) NOT NULL DEFAULT ''
      );
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disponibilidad_grupos_tipo_fecha"
        ON disponibilidad_grupos ("Tipo", "Fecha");
    `);
  }

  private async asegurarTablaAjustesEIdiomas(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ajustes_sistema (
        "Id" serial PRIMARY KEY,
        "IdiomaPredeterminado" varchar(5) NOT NULL DEFAULT 'es'
      );
    `);
    await this.dataSource.query(`
      INSERT INTO ajustes_sistema ("Id", "IdiomaPredeterminado")
      VALUES (1, 'es')
      ON CONFLICT ("Id") DO NOTHING;
    `);

    const alters: string[] = [
      `ALTER TABLE hero_principal ADD COLUMN IF NOT EXISTS "EyebrowEn" varchar(200) NOT NULL DEFAULT ''`,
      `ALTER TABLE hero_principal ADD COLUMN IF NOT EXISTS "TitleEn" varchar(500) NOT NULL DEFAULT ''`,
      `ALTER TABLE hero_principal ADD COLUMN IF NOT EXISTS "SubtitleEn" varchar(1000) NOT NULL DEFAULT ''`,
      `ALTER TABLE hero_principal ADD COLUMN IF NOT EXISTS "PrimaryButtonTextEn" varchar(200) NOT NULL DEFAULT ''`,
      `ALTER TABLE hero_principal ADD COLUMN IF NOT EXISTS "ButtonTextEn" varchar(200) NOT NULL DEFAULT ''`,
      `ALTER TABLE tarjetas_inicio ADD COLUMN IF NOT EXISTS "EtiquetaEn" varchar(100) NOT NULL DEFAULT ''`,
      `ALTER TABLE tarjetas_inicio ADD COLUMN IF NOT EXISTS "TituloEn" varchar(300) NOT NULL DEFAULT ''`,
      `ALTER TABLE tarjetas_inicio ADD COLUMN IF NOT EXISTS "DescripcionEn" varchar(2000) NOT NULL DEFAULT ''`,
      `ALTER TABLE tarjetas_inicio ADD COLUMN IF NOT EXISTS "TextoBotonEn" varchar(200) NOT NULL DEFAULT ''`,
      `ALTER TABLE textos_institucionales ADD COLUMN IF NOT EXISTS "EyebrowEn" varchar(200) NULL`,
      `ALTER TABLE textos_institucionales ADD COLUMN IF NOT EXISTS "TitleEn" varchar(500) NOT NULL DEFAULT ''`,
      `ALTER TABLE textos_institucionales ADD COLUMN IF NOT EXISTS "DescriptionEn" varchar(4000) NOT NULL DEFAULT ''`,
      `ALTER TABLE textos_institucionales ADD COLUMN IF NOT EXISTS "LinkTextEn" varchar(200) NULL`,
      `ALTER TABLE enlaces_sitio ADD COLUMN IF NOT EXISTS "EtiquetaEn" varchar(200) NOT NULL DEFAULT ''`,
      `ALTER TABLE informacion_footer ADD COLUMN IF NOT EXISTS "FraseMarcaEn" varchar(500) NOT NULL DEFAULT ''`,
      `ALTER TABLE informacion_footer ADD COLUMN IF NOT EXISTS "TextoCopyrightEn" varchar(500) NOT NULL DEFAULT ''`,
      `ALTER TABLE productos ADD COLUMN IF NOT EXISTS "NombreEn" varchar(200) NOT NULL DEFAULT ''`,
      `ALTER TABLE productos ADD COLUMN IF NOT EXISTS "DescripcionEn" varchar(2000) NOT NULL DEFAULT ''`,
    ];
    for (const sql of alters) {
      await this.dataSource.query(sql);
    }
  }

  /**
   * Si *En está vacío, rellena inglés a partir del español actual
   * (solo una vez; no pisa traducciones ya guardadas en el CMS).
   */
  private async asegurarTraduccionesInglesVacias(): Promise<void> {
    const mapaEnlace: Record<string, string> = {
      'Sobre nosotros': 'About us',
      Productos: 'Products',
      Voluntariado: 'Volunteering',
      Formularios: 'Forms',
      Donaciones: 'Donations',
      Visitas: 'Visits',
      Inicio: 'Home',
    };

    await this.dataSource.query(`
      UPDATE hero_principal SET
        "EyebrowEn" = CASE WHEN TRIM(COALESCE("EyebrowEn", '')) = '' AND TRIM(COALESCE("Eyebrow", '')) <> ''
          THEN CASE
            WHEN LOWER("Eyebrow") LIKE '%artesanal%' THEN 'Artisanal & organic'
            ELSE "Eyebrow"
          END ELSE "EyebrowEn" END,
        "TitleEn" = CASE WHEN TRIM(COALESCE("TitleEn", '')) = '' AND TRIM(COALESCE("Title", '')) <> ''
          THEN CASE
            WHEN LOWER("Title") LIKE '%universitario%' THEN 'The best coffee for university students'
            ELSE "Title"
          END ELSE "TitleEn" END,
        "SubtitleEn" = CASE WHEN TRIM(COALESCE("SubtitleEn", '')) = '' AND TRIM(COALESCE("Subtitle", '')) <> ''
          THEN CASE
            WHEN LOWER("Subtitle") LIKE '%deleitarte%' OR LOWER("Subtitle") LIKE '%espectacular%'
              THEN 'Come and enjoy this spectacular coffee'
            ELSE "Subtitle"
          END ELSE "SubtitleEn" END,
        "PrimaryButtonTextEn" = CASE WHEN TRIM(COALESCE("PrimaryButtonTextEn", '')) = '' AND TRIM(COALESCE("PrimaryButtonText", '')) <> ''
          THEN CASE
            WHEN LOWER("PrimaryButtonText") LIKE '%producto%' THEN 'View products'
            ELSE "PrimaryButtonText"
          END ELSE "PrimaryButtonTextEn" END,
        "ButtonTextEn" = CASE WHEN TRIM(COALESCE("ButtonTextEn", '')) = '' AND TRIM(COALESCE("ButtonText", '')) <> ''
          THEN CASE
            WHEN LOWER("ButtonText") LIKE '%producto%' THEN 'View products'
            WHEN LOWER("ButtonText") LIKE '%conoc%' OR LOWER("ButtonText") LIKE '%about%' THEN 'About us'
            WHEN LOWER("ButtonText") LIKE '%volunt%' THEN 'Volunteer'
            ELSE "ButtonText"
          END ELSE "ButtonTextEn" END
      WHERE "Id" = 1;
    `);

    await this.dataSource.query(`
      UPDATE informacion_footer SET
        "FraseMarcaEn" = CASE WHEN TRIM(COALESCE("FraseMarcaEn", '')) = '' AND TRIM(COALESCE("FraseMarca", '')) <> ''
          THEN CASE
            WHEN LOWER("FraseMarca") LIKE '%placer%' THEN 'An awakening to sensory pleasure'
            ELSE "FraseMarca"
          END ELSE "FraseMarcaEn" END,
        "TextoCopyrightEn" = CASE WHEN TRIM(COALESCE("TextoCopyrightEn", '')) = '' AND TRIM(COALESCE("TextoCopyright", '')) <> ''
          THEN CASE
            WHEN "TextoCopyright" ILIKE '%derechos%' THEN '© 2026 Café UNA. All rights reserved.'
            ELSE "TextoCopyright"
          END ELSE "TextoCopyrightEn" END
      WHERE "Id" = 1;
    `);

    for (const [es, en] of Object.entries(mapaEnlace)) {
      await this.dataSource.query(
        `
        UPDATE enlaces_sitio
        SET "EtiquetaEn" = $1
        WHERE TRIM(COALESCE("EtiquetaEn", '')) = ''
          AND LOWER(TRIM("Etiqueta")) = LOWER(TRIM($2));
        `,
        [en, es],
      );
    }

    await this.dataSource.query(`
      UPDATE textos_institucionales SET
        "TitleEn" = CASE WHEN TRIM(COALESCE("TitleEn", '')) = '' AND TRIM(COALESCE("Title", '')) <> '' THEN
          CASE
            WHEN "Clave" = 'homespotlight' THEN 'Learn more about Café UNA'
            WHEN "Clave" = 'homefeatured' THEN 'The best of our collection'
            WHEN "Clave" = 'homeiniciativas' THEN 'Every contribution, visit or collaboration leaves a special mark.'
            WHEN "Clave" = 'homelocation' THEN 'Visit us at the Santa Lucía Experimental Farm'
            ELSE "Title"
          END ELSE "TitleEn" END,
        "DescriptionEn" = CASE WHEN TRIM(COALESCE("DescriptionEn", '')) = '' AND TRIM(COALESCE("Description", '')) <> '' THEN
          CASE
            WHEN "Clave" = 'homespotlight' THEN 'Discover our story, purpose and the impact we build with local producers and the university community.'
            WHEN "Clave" = 'homefeatured' THEN 'Explore all our products and choose the coffee that best fits your taste, routine and way of enjoying it.'
            WHEN "Clave" = 'homeiniciativas' THEN 'Choose how you want to get involved with Café UNA and complete the corresponding form.'
            WHEN "Clave" = 'homelocation' THEN 'We are in Heredia, Barva. Open it in Google Maps to see the route and get here easily.'
            ELSE "Description"
          END ELSE "DescriptionEn" END,
        "EyebrowEn" = CASE WHEN TRIM(COALESCE("EyebrowEn", '')) = '' AND TRIM(COALESCE("Eyebrow", '')) <> '' THEN
          CASE
            WHEN "Clave" = 'homeiniciativas' THEN 'Get involved with us'
            WHEN "Clave" = 'homelocation' THEN 'Our location'
            ELSE "Eyebrow"
          END ELSE "EyebrowEn" END,
        "LinkTextEn" = CASE WHEN TRIM(COALESCE("LinkTextEn", '')) = '' AND TRIM(COALESCE("LinkText", '')) <> '' THEN
          CASE
            WHEN "Clave" = 'homespotlight' THEN 'Read our full story'
            WHEN "Clave" = 'homefeatured' THEN 'Browse our catalog'
            WHEN "Clave" = 'homelocation' THEN 'Open in Google Maps'
            ELSE "LinkText"
          END ELSE "LinkTextEn" END
      WHERE "Clave" IN ('homespotlight', 'homefeatured', 'homeiniciativas', 'homelocation');
    `);

    this.logger.log('Traducciones EN vacías rellenadas (solo donde *En estaba vacío).');
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
        -- Nunca guardar contraseña en texto plano en la bitácora
        IF v_old IS NOT NULL THEN
          IF v_old ? 'PasswordHash' THEN
            IF left(COALESCE(v_old->>'PasswordHash', ''), 2) = '$2' THEN
              v_old := jsonb_set(v_old, '{PasswordHash}', to_jsonb(left(v_old->>'PasswordHash', 20) || '...'));
            ELSE
              v_old := jsonb_set(v_old, '{PasswordHash}', '"[hash]"');
            END IF;
          END IF;
          v_old := v_old - 'password' - 'Password' - 'contrasena' - 'Contraseña';
        END IF;
        IF v_new IS NOT NULL THEN
          IF v_new ? 'PasswordHash' THEN
            IF left(COALESCE(v_new->>'PasswordHash', ''), 2) = '$2' THEN
              v_new := jsonb_set(v_new, '{PasswordHash}', to_jsonb(left(v_new->>'PasswordHash', 20) || '...'));
            ELSE
              v_new := jsonb_set(v_new, '{PasswordHash}', '"[hash]"');
            END IF;
          END IF;
          v_new := v_new - 'password' - 'Password' - 'contrasena' - 'Contraseña';
        END IF;
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
      'roles',
      'permisos',
      'rol_permiso',
      'disponibilidad_grupos',
      'donacion_necesidades',
      'donacion_solicitudes',
      'fechas_voluntariado',
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

  private async asegurarTablasDonaciones(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS donacion_necesidades (
        "Id" serial PRIMARY KEY,
        "Uuid" uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        "Titulo" varchar(200) NOT NULL,
        "Descripcion" varchar(2000) NOT NULL,
        "Prioridad" varchar(10) NOT NULL,
        "CantidadRequerida" integer NULL,
        "Estado" varchar(10) NOT NULL DEFAULT 'ACTIVA',
        "CreatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "UpdatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "DeletedAt" timestamptz NULL,
        CONSTRAINT "CK_donacion_necesidades_prioridad"
          CHECK ("Prioridad" IN ('ALTA', 'MEDIA', 'BAJA')),
        CONSTRAINT "CK_donacion_necesidades_estado"
          CHECK ("Estado" IN ('ACTIVA', 'INACTIVA')),
        CONSTRAINT "CK_donacion_necesidades_cantidad"
          CHECK ("CantidadRequerida" IS NULL OR "CantidadRequerida" > 0)
      );
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_donacion_necesidades_Estado"
        ON donacion_necesidades ("Estado");
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS donacion_solicitudes (
        "Id" serial PRIMARY KEY,
        "UsuarioId" integer NOT NULL,
        "NecesidadId" integer NULL REFERENCES donacion_necesidades("Id") ON DELETE SET NULL,
        "Tipo" varchar(200) NOT NULL,
        "Descripcion" varchar(2000) NOT NULL,
        "FechaPropuesta" date NOT NULL,
        "Detalles" jsonb NULL,
        "Estado" varchar(20) NOT NULL DEFAULT 'Pendiente',
        "CreatedAt" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "CK_donacion_solicitudes_estado"
          CHECK ("Estado" IN ('Pendiente', 'Aceptada', 'Rechazada'))
      );
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_donacion_solicitudes_UsuarioId"
        ON donacion_solicitudes ("UsuarioId");
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_donacion_solicitudes_Estado"
        ON donacion_solicitudes ("Estado");
    `);
    await this.dataSource.query(`
      ALTER TABLE donacion_solicitudes
        ADD COLUMN IF NOT EXISTS "Detalles" jsonb NULL;
    `);
    await this.dataSource.query(`
      UPDATE tarjetas_inicio
      SET "Ruta" = '/donaciones/solicitar'
      WHERE LOWER(TRIM("Clave")) = 'donaciones'
        AND (
          "Ruta" IS NULL
          OR TRIM("Ruta") = ''
          OR "Ruta" LIKE '/donaciones/necesidades%'
        );
    `);
    await this.dataSource.query(`
      UPDATE enlaces_sitio
      SET "Etiqueta" = 'Formularios',
          "EtiquetaEn" = 'Forms'
      WHERE LOWER(TRIM("Seccion")) = 'navbar'
        AND LOWER(TRIM("Etiqueta")) IN ('voluntariado', 'volunteering');
    `);
    await this.dataSource.query(`
      INSERT INTO donacion_necesidades ("Titulo", "Descripcion", "Prioridad", "CantidadRequerida", "Estado")
      SELECT * FROM (VALUES
        (
          'Herramientas agrícolas',
          'Palas, rastrillos y machetes para el mantenimiento de los cafetales de la finca experimental.',
          'ALTA',
          12,
          'ACTIVA'
        ),
        (
          'Materiales de empaque',
          'Bolsas de papel y etiquetas para empacar café de especialidad en los puntos de venta.',
          'MEDIA',
          200,
          'ACTIVA'
        ),
        (
          'Insumos de limpieza',
          'Jabón biodegradable y paños para las áreas de tostado y empaque.',
          'BAJA',
          20,
          'ACTIVA'
        )
      ) AS semilla("Titulo", "Descripcion", "Prioridad", "CantidadRequerida", "Estado")
      WHERE NOT EXISTS (SELECT 1 FROM donacion_necesidades LIMIT 1);
    `);
  }
}
